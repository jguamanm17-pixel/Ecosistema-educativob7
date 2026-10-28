// servidor/rutas/quiz.js · Motor del quiz, gestión de sesiones y evaluación
import { Router } from 'express';
import * as almacen from '../almacen.js';
import { asignaturaDeTema, asignaturasDe } from '../acceso.js';
import { procesarIntento } from '../gamificacion.js';
import { notificar } from '../notificar.js';

const router = Router();

const asincrono = (controlador) => (req, res, next) => {
  Promise.resolve(controlador(req, res, next)).catch(next);
};

const NOMBRES_NIVELES = {
  1: 'Recordar',
  2: 'Comprender',
  3: 'Aplicar',
  4: 'Analizar',
  5: 'Evaluar'
};

/**
 * Normaliza una cadena de texto para comparación flexible
 * @param {string} texto
 * @returns {string}
 */
function normalizar(texto) {
  if (texto === null || texto === undefined) return '';
  let s = String(texto).trim().toUpperCase();
  s = s.replaceAll('Ñ', '\u0001');
  s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  s = s.replaceAll('\u0001', 'Ñ');
  return s;
}

/**
 * Baraja un arreglo in-place usando el algoritmo Fisher-Yates
 * @param {Array} lista
 * @returns {Array}
 */
function barajar(lista) {
  if (!Array.isArray(lista)) return [];
  for (let i = lista.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [lista[i], lista[j]] = [lista[j], lista[i]];
  }
  return lista;
}

/**
 * Valida que el usuario tenga acceso al tema académico
 * @param {Object} usuario
 * @param {string} temaId
 * @returns {Promise<string>} asignaturaId
 */
async function validarAccesoTema(usuario, temaId) {
  if (!usuario) {
    throw Object.assign(new Error('Acceso no autorizado'), { estado: 401 });
  }

  if (usuario.rol !== 'estudiante' && usuario.rol !== 'docente' && usuario.rol !== 'admin') {
    throw Object.assign(
      new Error('Acceso no autorizado para este rol'),
      { estado: 403 }
    );
  }

  if (!temaId) {
    throw Object.assign(new Error('El parámetro temaId es obligatorio'), { estado: 400 });
  }

  const asignaturaId = await asignaturaDeTema(temaId);
  if (!asignaturaId) {
    throw Object.assign(new Error('El tema indicado no existe'), { estado: 404 });
  }

  if (usuario.rol === 'estudiante') {
    const misAsignaturas = await asignaturasDe(usuario);
    const tieneAcceso = misAsignaturas.some((a) => a.id === asignaturaId);
    if (!tieneAcceso) {
      throw Object.assign(
        new Error('No tienes acceso a los contenidos de este tema'),
        { estado: 403 }
      );
    }
  }

  return asignaturaId;
}

// 1. GET /api/quiz/estado?temaId=
router.get(
  '/quiz/estado',
  asincrono(async (req, res) => {
    const { temaId } = req.query;
    await validarAccesoTema(req.usuario, temaId);

    // Obtener nivel aprobado actual en logros
    const todosLogros = await almacen.leer('logros');
    const logro = todosLogros.find((l) => l.usuarioId === req.usuario.id);
    const nivelAprobado = Number(logro?.nivelQuiz?.[temaId]) || 0;

    // Obtener sesiones e intentos del usuario para calcular mejor porcentaje
    const todasSesiones = await almacen.leer('quiz-sesiones');
    const misSesiones = todasSesiones.filter(
      (s) => s.usuarioId === req.usuario.id && s.temaId === temaId && s.finalizada === true
    );

    const todosIntentos = await almacen.leer('intentos');
    const misIntentos = todosIntentos.filter(
      (i) => i.usuarioId === req.usuario.id && i.actividad === 'quiz' && i.temaId === temaId
    );

    const niveles = [];
    for (let n = 1; n <= 5; n++) {
      let estado = 'bloqueado';
      if (n <= nivelAprobado) {
        estado = 'aprobado';
      } else if (n === 1 || n === nivelAprobado + 1) {
        estado = 'disponible';
      }

      // Mejor porcentaje registrado
      let mejorPorcentaje = 0;
      const sesionesNivel = misSesiones.filter((s) => Number(s.nivel) === n && s.porcentaje !== undefined);
      if (sesionesNivel.length > 0) {
        mejorPorcentaje = Math.max(mejorPorcentaje, ...sesionesNivel.map((s) => Number(s.porcentaje) || 0));
      }

      const intentosNivel = misIntentos.filter((i) => Number(i.nivel) === n && i.maximo > 0);
      if (intentosNivel.length > 0) {
        mejorPorcentaje = Math.max(
          mejorPorcentaje,
          ...intentosNivel.map((i) => Math.round((Number(i.puntaje) / Number(i.maximo)) * 100))
        );
      }

      niveles.push({
        nivel: n,
        nombre: NOMBRES_NIVELES[n],
        estado,
        mejorPorcentaje
      });
    }

    res.json({ niveles });
  })
);

// 2. POST /api/quiz/iniciar { temaId, nivel }
router.post(
  '/quiz/iniciar',
  asincrono(async (req, res) => {
    const { temaId, nivel } = req.body || {};
    const asignaturaId = await validarAccesoTema(req.usuario, temaId);

    const nivelNum = Number(nivel);
    if (isNaN(nivelNum) || nivelNum < 1 || nivelNum > 5) {
      return res.status(400).json({ error: 'El nivel debe ser un número entero entre 1 y 5' });
    }

    // Verificar que el nivel esté disponible o aprobado
    const todosLogros = await almacen.leer('logros');
    const logro = todosLogros.find((l) => l.usuarioId === req.usuario.id);
    const nivelAprobado = Number(logro?.nivelQuiz?.[temaId]) || 0;

    const estaDisponible = nivelNum <= nivelAprobado || nivelNum === 1 || nivelNum === nivelAprobado + 1;
    if (!estaDisponible) {
      return res.status(400).json({
        error: 'El nivel seleccionado está bloqueado. Debes aprobar el nivel anterior primero.'
      });
    }

    const reglas = await almacen.leerConfig('reglas-gamificacion');
    const cantidadRequerida = Number(reglas?.quiz?.preguntasPorNivel) || 10;

    // Preguntas aprobadas del tema y nivel
    const todasPreguntas = await almacen.leer('preguntas');
    const preguntasNivel = todasPreguntas.filter(
      (p) => p.temaId === temaId && Number(p.nivel) === nivelNum && p.estado === 'aprobado'
    );

    if (preguntasNivel.length === 0) {
      return res.status(400).json({
        error: 'No hay preguntas aprobadas disponibles para este tema y nivel'
      });
    }

    // Determinar preguntas vistas por el estudiante en quiz-sesiones previas
    const todasSesiones = await almacen.leer('quiz-sesiones');
    const misSesiones = todasSesiones.filter(
      (s) => s.usuarioId === req.usuario.id && s.temaId === temaId && Number(s.nivel) === nivelNum
    );

    const vistaTimestamps = new Map();
    for (const ses of misSesiones) {
      const fechaSes = new Date(ses.inicio || ses.fecha || 0).getTime();
      for (const qId of ses.preguntasIds || []) {
        const anterior = vistaTimestamps.get(qId) || 0;
        if (fechaSes > anterior) {
          vistaTimestamps.set(qId, fechaSes);
        }
      }
    }

    const noVistas = preguntasNivel.filter((p) => !vistaTimestamps.has(p.id));
    const vistas = preguntasNivel.filter((p) => vistaTimestamps.has(p.id));
    barajar(noVistas);

    let seleccionadas = [];
    let requirioCompletar = false;

    if (noVistas.length >= cantidadRequerida) {
      seleccionadas = noVistas.slice(0, cantidadRequerida);
    } else {
      seleccionadas = [...noVistas];
      requirioCompletar = true;
      // Completar con las vistas hace más tiempo (menor timestamp primero)
      vistas.sort((a, b) => (vistaTimestamps.get(a.id) || 0) - (vistaTimestamps.get(b.id) || 0));
      const faltantes = cantidadRequerida - seleccionadas.length;
      seleccionadas.push(...vistas.slice(0, faltantes));
    }

    // Si no alcanzaron las no vistas, notificar al docente del grupo (máximo 1 vez al día por tema y nivel)
    if (requirioCompletar) {
      try {
        const distributivo = await almacen.leer('distributivo');
        const grupo = distributivo.find(
          (d) =>
            d.asignaturaId === asignaturaId &&
            Array.isArray(d.estudiantes) &&
            d.estudiantes.includes(req.usuario.id)
        );
        const docenteId = grupo?.docenteId;

        if (docenteId) {
          const hoy = new Date().toISOString().slice(0, 10);
          const notificaciones = await almacen.leer('notificaciones');
          const yaNotificadoHoy = notificaciones.some(
            (not) =>
              not.usuarioId === docenteId &&
              (not.fecha || '').slice(0, 10) === hoy &&
              not.enlace?.includes(`temaId=${temaId}`) &&
              not.mensaje?.includes(`Nivel ${nivelNum}`)
          );

          if (!yaNotificadoHoy) {
            const temas = await almacen.leer('temas');
            const tema = temas.find((t) => t.id === temaId);
            await notificar(docenteId, {
              tipo: 'alerta',
              mensaje: `Banco de preguntas insuficiente en "${tema?.titulo || 'Tema'}" (Nivel ${nivelNum}). Un estudiante ha reutilizado preguntas previas.`,
              enlace: `/paginas/banco-preguntas.html?temaId=${temaId}`
            });
          }
        }
      } catch (errNotif) {
        console.warn('Aviso al notificar al docente:', errNotif.message);
      }
    }

    barajar(seleccionadas);

    const nuevaSesion = {
      usuarioId: req.usuario.id,
      temaId,
      nivel: nivelNum,
      preguntasIds: seleccionadas.map((p) => p.id),
      respuestas: {},
      inicio: new Date().toISOString(),
      finalizada: false
    };

    const sesionCreada = await almacen.agregar('quiz-sesiones', nuevaSesion);

    res.status(201).json({
      sesionId: sesionCreada.id,
      preguntas: seleccionadas.map((p) => ({
        id: p.id,
        tipo: p.tipo,
        enunciado: p.enunciado,
        opciones: Array.isArray(p.opciones) ? p.opciones : []
      }))
    });
  })
);

// 3. POST /api/quiz/responder { sesionId, preguntaId, respuesta }
router.post(
  '/quiz/responder',
  asincrono(async (req, res) => {
    if (!req.usuario) {
      return res.status(401).json({ error: 'Acceso no autorizado' });
    }

    const { sesionId, preguntaId, respuesta } = req.body || {};
    if (!sesionId || !preguntaId) {
      return res.status(400).json({ error: 'sesionId y preguntaId son obligatorios' });
    }

    const sesiones = await almacen.leer('quiz-sesiones');
    const sesion = sesiones.find((s) => s.id === sesionId);

    if (!sesion) {
      return res.status(404).json({ error: 'Sesión de quiz no encontrada' });
    }

    if (sesion.usuarioId !== req.usuario.id) {
      return res.status(403).json({ error: 'Acceso no autorizado a esta sesión' });
    }

    if (sesion.finalizada) {
      return res.status(400).json({ error: 'Esta sesión de quiz ya ha sido finalizada' });
    }

    if (!Array.isArray(sesion.preguntasIds) || !sesion.preguntasIds.includes(preguntaId)) {
      return res.status(400).json({ error: 'La pregunta no pertenece a esta sesión de quiz' });
    }

    sesion.respuestas = sesion.respuestas || {};
    if (sesion.respuestas[preguntaId]) {
      return res.status(400).json({ error: 'Esta pregunta ya ha sido respondida en esta sesión' });
    }

    const preguntas = await almacen.leer('preguntas');
    const pregunta = preguntas.find((p) => p.id === preguntaId);

    if (!pregunta) {
      return res.status(404).json({ error: 'Pregunta no encontrada' });
    }

    let correcto = false;
    let correctaTexto = '';

    if (pregunta.tipo === 'opcion') {
      correcto = Number(respuesta) === Number(pregunta.correcta);
      const idx = Number(pregunta.correcta);
      correctaTexto = Array.isArray(pregunta.opciones) && pregunta.opciones[idx] !== undefined
        ? String(pregunta.opciones[idx])
        : String(pregunta.correcta);
    } else if (pregunta.tipo === 'vf') {
      const respBool = respuesta === true || String(respuesta).toLowerCase() === 'true' || respuesta === 0;
      const corrBool = pregunta.correcta === true || String(pregunta.correcta).toLowerCase() === 'true' || pregunta.correcta === 0;
      correcto = respBool === corrBool;
      correctaTexto = corrBool ? 'Verdadero' : 'Falso';
    } else if (pregunta.tipo === 'completar') {
      correcto = normalizar(respuesta) === normalizar(pregunta.correcta);
      correctaTexto = String(pregunta.correcta || '');
    }

    sesion.respuestas[preguntaId] = {
      respuesta,
      correcto,
      fecha: new Date().toISOString()
    };

    await almacen.actualizar('quiz-sesiones', sesion.id, { respuestas: sesion.respuestas });

    res.json({
      correcto,
      retroalimentacion: pregunta.retroalimentacion || '',
      correcta: correctaTexto
    });
  })
);

// 4. POST /api/quiz/finalizar { sesionId }
router.post(
  '/quiz/finalizar',
  asincrono(async (req, res) => {
    if (!req.usuario) {
      return res.status(401).json({ error: 'Acceso no autorizado' });
    }

    const { sesionId } = req.body || {};
    if (!sesionId) {
      return res.status(400).json({ error: 'El parámetro sesionId es obligatorio' });
    }

    const sesiones = await almacen.leer('quiz-sesiones');
    const sesion = sesiones.find((s) => s.id === sesionId);

    if (!sesion) {
      return res.status(404).json({ error: 'Sesión de quiz no encontrada' });
    }

    if (sesion.usuarioId !== req.usuario.id) {
      return res.status(403).json({ error: 'Acceso no autorizado a esta sesión' });
    }

    if (sesion.finalizada) {
      return res.status(400).json({ error: 'La sesión de quiz ya fue finalizada' });
    }

    const total = Array.isArray(sesion.preguntasIds) ? sesion.preguntasIds.length : 0;
    if (total === 0) {
      return res.status(400).json({ error: 'La sesión no contiene preguntas' });
    }

    const preguntas = await almacen.leer('preguntas');
    const mapaPreguntas = new Map(preguntas.map((p) => [p.id, p]));

    let aciertos = 0;
    const repasar = [];

    for (const pId of sesion.preguntasIds) {
      const resp = sesion.respuestas?.[pId];
      if (resp && resp.correcto === true) {
        aciertos++;
      } else {
        const p = mapaPreguntas.get(pId);
        if (p?.retroalimentacion && p.retroalimentacion.trim()) {
          repasar.push(p.retroalimentacion.trim());
        }
      }
    }

    const errores = total - aciertos;
    const porcentaje = Math.round((aciertos / total) * 100);

    const reglas = await almacen.leerConfig('reglas-gamificacion');
    const porcentajeAprobacion = Number(reglas?.quiz?.porcentajeAprobacion) || 70;
    const aprobado = porcentaje >= porcentajeAprobacion;

    const inicioMs = new Date(sesion.inicio || sesion.fecha).getTime();
    const duracionSeg = Math.max(0, Math.round((Date.now() - inicioMs) / 1000));

    // Actualizar sesión como finalizada
    await almacen.actualizar('quiz-sesiones', sesion.id, {
      finalizada: true,
      fin: new Date().toISOString(),
      porcentaje,
      aprobado,
      aciertos,
      errores,
      total
    });

    // Si aprueba, primero actualiza logros.nivelQuiz[temaId] al máximo
    if (aprobado) {
      const todosLogros = await almacen.leer('logros');
      let logro = todosLogros.find((l) => l.usuarioId === req.usuario.id);
      if (!logro) {
        logro = await almacen.agregar('logros', {
          usuarioId: req.usuario.id,
          puntos: 0,
          insignias: [],
          nivelQuiz: {}
        });
      }
      logro.nivelQuiz = (logro.nivelQuiz && typeof logro.nivelQuiz === 'object') ? logro.nivelQuiz : {};
      const nivelActual = Number(logro.nivelQuiz[sesion.temaId]) || 0;
      if (Number(sesion.nivel) > nivelActual) {
        logro.nivelQuiz[sesion.temaId] = Number(sesion.nivel);
        await almacen.actualizar('logros', logro.id, { nivelQuiz: logro.nivelQuiz });
      }
    }

    // En todos los casos llamar a procesarIntento
    const resIntento = await procesarIntento(req.usuario, {
      actividad: 'quiz',
      temaId: sesion.temaId,
      nivel: Number(sesion.nivel),
      puntaje: aciertos,
      maximo: total,
      errores,
      duracionSeg,
      detalle: { aprobado }
    });

    res.json({
      porcentaje,
      aprobado,
      aciertos,
      total,
      repasar,
      puntosGanados: resIntento.puntosGanados || 0,
      insigniasNuevas: resIntento.insigniasNuevas || []
    });
  })
);

export default router;
