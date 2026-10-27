// servidor/gamificacion.js · Motor de gamificación, cálculo de puntos e insignias
import * as almacen from './almacen.js';
import { asignaturasDe, asignaturaDeTema } from './acceso.js';
import { evaluarAlertas } from './alertas.js';

// Control de intentos por hora en memoria (usuarioId -> [timestamps])
const intentosPorHora = new Map();

function validarLimitePorHora(usuarioId, limite) {
  const ahora = Date.now();
  const unaHora = 60 * 60 * 1000;
  const timestamps = (intentosPorHora.get(usuarioId) || []).filter((t) => ahora - t < unaHora);

  if (timestamps.length >= limite) {
    throw Object.assign(
      new Error('Límite de intentos por hora alcanzado. Intente de nuevo más tarde.'),
      { estado: 429 }
    );
  }

  timestamps.push(ahora);
  intentosPorHora.set(usuarioId, timestamps);
}

// Obtiene el valor de una clave anidada (ej: "detalle.simulacionId")
function obtenerValorCampo(obj, ruta) {
  if (!obj || typeof ruta !== 'string') return undefined;
  const partes = ruta.split('.');
  let actual = obj;
  for (const parte of partes) {
    if (actual === null || actual === undefined) return undefined;
    actual = actual[parte];
  }
  return actual;
}

/**
 * Procesa un intento de actividad, calcula puntos, actualiza logros y evalúa insignias
 * @param {Object} usuario - Usuario autenticado
 * @param {Object} datos - Datos del intento
 * @returns {Promise<{puntosGanados: number, puntosTotales: number, insigniasNuevas: Array}>}
 */
export async function procesarIntento(usuario, datos) {
  if (!usuario || !usuario.id) {
    throw Object.assign(new Error('Acceso no autorizado'), { estado: 401 });
  }

  const reglas = await almacen.leerConfig('reglas-gamificacion');
  const actividad = datos.actividad;

  // 1. Validaciones
  if (!actividad || typeof reglas?.puntos?.[actividad] !== 'number') {
    throw Object.assign(
      new Error(`La actividad "${actividad}" no es válida o no está configurada`),
      { estado: 400 }
    );
  }

  const puntaje = Number(datos.puntaje);
  const maximo = Number(datos.maximo);

  if (isNaN(puntaje) || isNaN(maximo) || maximo <= 0 || puntaje < 0 || puntaje > maximo) {
    throw Object.assign(
      new Error('El puntaje debe ser numérico, 0 <= puntaje <= maximo y maximo > 0'),
      { estado: 400 }
    );
  }

  // Si viene temaId, validar acceso del usuario al tema
  if (datos.temaId) {
    const asignaturaId = await asignaturaDeTema(datos.temaId);
    if (!asignaturaId) {
      throw Object.assign(new Error('El tema académico indicado no existe o no tiene asignatura'), { estado: 400 });
    }

    if (usuario.rol !== 'admin') {
      const misAsignaturas = await asignaturasDe(usuario);
      const tieneAcceso = misAsignaturas.some((a) => a.id === asignaturaId);
      if (!tieneAcceso) {
        throw Object.assign(new Error('No tienes acceso a los contenidos de este tema'), { estado: 403 });
      }
    }
  }

  // Rate-limit: máximo intentos por hora en memoria
  const limiteHora = Number(reglas.limiteIntentosHora) || 60;
  validarLimitePorHora(usuario.id, limiteHora);

  // 2. Cálculo de puntos
  const puntosBase = Math.round((reglas.puntos[actividad] * puntaje) / maximo);
  const errores = Number(datos.errores) || 0;
  const bono = (errores === 0 && puntaje === maximo && reglas.bonoSinErrores)
    ? Number(reglas.bonoSinErrores)
    : 0;
  const puntosCalculados = puntosBase + bono;

  // 3. Condiciones para guardar sin puntos
  const intentosExistentes = await almacen.leer('intentos');
  let sinPuntos = false;

  // a) Actividad única ya premiada previamente con la misma clave
  if (reglas.unicas && Array.isArray(reglas.unicas[actividad])) {
    const camposClave = reglas.unicas[actividad];
    const yaOtorgado = intentosExistentes.some((i) => {
      if (i.usuarioId !== usuario.id || i.actividad !== actividad || !(i.puntos > 0)) {
        return false;
      }
      return camposClave.every((campo) => {
        const valNuevo = obtenerValorCampo(datos, campo);
        const valExistente = obtenerValorCampo(i, campo);
        return valNuevo !== undefined && String(valNuevo) === String(valExistente);
      });
    });

    if (yaOtorgado) {
      sinPuntos = true;
    }
  }

  // b) Requiere aprobado y no aprobó
  if (Array.isArray(reglas.requiereAprobado) && reglas.requiereAprobado.includes(actividad)) {
    if (datos.detalle?.aprobado !== true) {
      sinPuntos = true;
    }
  }

  // c) Superó el máximo diario de intentos con puntos
  if (reglas.maxDiario && typeof reglas.maxDiario[actividad] === 'number') {
    const hoyIso = new Date().toISOString().slice(0, 10);
    const intentosHoyConPuntos = intentosExistentes.filter((i) => {
      if (i.usuarioId !== usuario.id || i.actividad !== actividad || !(i.puntos > 0)) {
        return false;
      }
      const fechaIntento = (i.fecha || '').slice(0, 10);
      return fechaIntento === hoyIso;
    });

    if (intentosHoyConPuntos.length >= reglas.maxDiario[actividad]) {
      sinPuntos = true;
    }
  }

  const puntosGanados = sinPuntos ? 0 : puntosCalculados;

  // 4. Guardar intento
  const nuevoIntento = {
    usuarioId: usuario.id,
    actividad,
    temaId: datos.temaId || null,
    nivel: datos.nivel !== undefined ? datos.nivel : null,
    puntaje,
    maximo,
    errores,
    duracionSeg: Number(datos.duracionSeg) || 0,
    detalle: datos.detalle || {},
    puntos: puntosGanados
  };

  const intentoGuardado = await almacen.agregar('intentos', nuevoIntento);

  // 5. Cargar o crear logros del usuario
  const todosLogros = await almacen.leer('logros');
  let logro = todosLogros.find((l) => l.usuarioId === usuario.id);

  if (!logro) {
    logro = await almacen.agregar('logros', {
      usuarioId: usuario.id,
      puntos: 0,
      insignias: [],
      nivelQuiz: {}
    });
  }

  logro.puntos = (logro.puntos || 0) + puntosGanados;
  logro.insignias = Array.isArray(logro.insignias) ? logro.insignias : [];
  logro.nivelQuiz = (logro.nivelQuiz && typeof logro.nivelQuiz === 'object') ? logro.nivelQuiz : {};

  // Registrar nivel de quiz si aprobó
  if (actividad === 'quiz' && datos.temaId && datos.nivel !== undefined && datos.detalle?.aprobado === true) {
    const nivelNum = Number(datos.nivel);
    const nivelActual = Number(logro.nivelQuiz[datos.temaId]) || 0;
    if (nivelNum > nivelActual) {
      logro.nivelQuiz[datos.temaId] = nivelNum;
    }
  }

  // 6. Evaluar insignias no obtenidas
  const todasInsignias = await almacen.leer('insignias');
  const obtenidasSet = new Set(logro.insignias.map((ins) => ins.id));
  const insigniasNuevas = [];

  const misIntentos = [...intentosExistentes.filter((i) => i.usuarioId === usuario.id), intentoGuardado];

  for (const insignia of todasInsignias) {
    if (obtenidasSet.has(insignia.id)) continue;

    const cond = insignia.condicion;
    if (!cond || !cond.tipo) continue;

    let cumplida = false;

    // Tipo: conteo
    if (cond.tipo === 'conteo' && cond.actividad) {
      const intentosActividad = misIntentos.filter((i) => i.actividad === cond.actividad);
      if (reglas.unicas && Array.isArray(reglas.unicas[cond.actividad])) {
        const camposClave = reglas.unicas[cond.actividad];
        const clavesDistintas = new Set();
        for (const i of intentosActividad) {
          const clave = camposClave.map((c) => String(obtenerValorCampo(i, c))).join('::');
          clavesDistintas.add(clave);
        }
        if (clavesDistintas.size >= cond.minimo) {
          cumplida = true;
        }
      } else {
        if (intentosActividad.length >= cond.minimo) {
          cumplida = true;
        }
      }
    }

    // Tipo: sinErrores
    if (cond.tipo === 'sinErrores' && cond.actividad) {
      const huboSinErrores = misIntentos.some(
        (i) => i.actividad === cond.actividad && Number(i.errores) === 0 && Number(i.puntaje) === Number(i.maximo) && Number(i.maximo) > 0
      );
      if (huboSinErrores) {
        cumplida = true;
      }
    }

    // Tipo: puntos
    if (cond.tipo === 'puntos' && typeof cond.minimo === 'number') {
      if (logro.puntos >= cond.minimo) {
        cumplida = true;
      }
    }

    // Tipo: nivelQuiz (en cualquier tema)
    if (cond.tipo === 'nivelQuiz' && typeof cond.nivel === 'number') {
      const niveles = Object.values(logro.nivelQuiz || {});
      if (niveles.some((n) => Number(n) >= cond.nivel)) {
        cumplida = true;
      }
    }

    // Tipo: racha (días consecutivos con intentos hasta hoy)
    if (cond.tipo === 'racha' && typeof cond.dias === 'number') {
      const fechasSet = new Set(
        misIntentos.map((i) => (i.fecha || '').slice(0, 10)).filter(Boolean)
      );
      const hoyIso = new Date().toISOString().slice(0, 10);

      if (fechasSet.has(hoyIso)) {
        let diasRacha = 1;
        const fechaCursor = new Date(hoyIso);

        while (true) {
          fechaCursor.setDate(fechaCursor.getDate() - 1);
          const diaAnteriorIso = fechaCursor.toISOString().slice(0, 10);
          if (fechasSet.has(diaAnteriorIso)) {
            diasRacha++;
          } else {
            break;
          }
        }

        if (diasRacha >= cond.dias) {
          cumplida = true;
        }
      }
    }

    if (cumplida) {
      logro.insignias.push({
        id: insignia.id,
        fecha: new Date().toISOString()
      });
      obtenidasSet.add(insignia.id);
      insigniasNuevas.push({
        id: insignia.id,
        nombre: insignia.nombre,
        icono: insignia.icono
      });
    }
  }

  // Guardar logros actualizados
  await almacen.actualizar('logros', logro.id, {
    puntos: logro.puntos,
    insignias: logro.insignias,
    nivelQuiz: logro.nivelQuiz
  });

  // 7. Evaluar alertas tempranas en try/catch
  try {
    await evaluarAlertas(intentoGuardado, usuario);
  } catch (err) {
    console.debug('Aviso al evaluar alertas tempranas:', err.message);
  }

  // 8. Respuesta
  return {
    puntosGanados,
    puntosTotales: logro.puntos,
    insigniasNuevas
  };
}

export default {
  procesarIntento
};
