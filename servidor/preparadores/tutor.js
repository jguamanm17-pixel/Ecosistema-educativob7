// servidor/preparadores/tutor.js · Preparador de contexto curricular y socrático para el tutor IA
import * as almacen from '../almacen.js';
import { asignaturasDe, asignaturaDeTema } from '../acceso.js';

/**
 * Prepara el contexto curricular restringido a la asignatura para la interacción socrática
 * @param {Object} cuerpo - { asignaturaId, temaId, pregunta, historial }
 * @param {Object} usuario - Usuario en sesión
 * @returns {Promise<Object>} Variables para servidor/prompts/tutor.txt
 */
export default async function preparar(cuerpo, usuario) {
  if (!usuario) {
    throw Object.assign(new Error('Acceso no autorizado'), { estado: 401 });
  }

  const pregunta = (cuerpo.pregunta || '').trim();
  if (!pregunta) {
    throw Object.assign(new Error('Debes escribir una pregunta o razonamiento para el tutor'), { estado: 400 });
  }

  // 1. Resolver y validar asignatura
  let asignaturaId = cuerpo.asignaturaId;
  const temaId = cuerpo.temaId && cuerpo.temaId !== 'todos' ? cuerpo.temaId : null;

  if (!asignaturaId && temaId) {
    asignaturaId = await asignaturaDeTema(temaId);
  }

  if (!asignaturaId) {
    throw Object.assign(new Error('El parámetro asignaturaId es obligatorio'), { estado: 400 });
  }

  // 2. Verificar permisos de acceso a la asignatura
  if (usuario.rol !== 'admin') {
    const permitidas = await asignaturasDe(usuario);
    const tieneAcceso = permitidas.some((a) => a.id === asignaturaId);
    if (!tieneAcceso && usuario.rol === 'estudiante') {
      throw Object.assign(
        new Error('No tienes acceso a los contenidos curriculares de esta asignatura'),
        { estado: 403 }
      );
    }
  }

  // 3. Validar límite diario de consultas (limiteTutorDiario de ajustes.json)
  const ajustes = await almacen.leerConfig('ajustes');
  const limiteDiario = Number(ajustes?.limiteTutorDiario) || 40;
  const hoy = new Date().toISOString().slice(0, 10);

  const consultasHoy = await almacen.buscar('consultas-tutor', {
    usuarioId: usuario.id,
    dia: hoy
  });

  const totalMensajesHoy = consultasHoy.reduce(
    (acum, reg) => acum + (Number(reg.mensajes) || 1),
    0
  );

  if (totalMensajesHoy >= limiteDiario) {
    throw Object.assign(
      new Error(`Has alcanzado el límite diario de ${limiteDiario} consultas con el tutor socrático. ¡Gran jornada de estudio! Vuelve mañana para continuar.`),
      { estado: 429 }
    );
  }

  // 4. Obtener datos curriculares oficiales de la asignatura
  const asignaturas = await almacen.leer('asignaturas');
  const asignatura = asignaturas.find((a) => a.id === asignaturaId);
  if (!asignatura) {
    throw Object.assign(new Error('Asignatura no encontrada'), { estado: 404 });
  }

  const todasUnidades = await almacen.leer('unidades');
  const unidades = todasUnidades
    .filter((u) => u.asignaturaId === asignaturaId && u.visible !== false)
    .sort((a, b) => (Number(a.orden) || 0) - (Number(b.orden) || 0));

  const todosTemas = await almacen.leer('temas');
  const idsUnidades = new Set(unidades.map((u) => u.id));
  const temasPublicados = todosTemas
    .filter((t) => idsUnidades.has(t.unidadId) && t.estado === 'publicado')
    .sort((a, b) => (Number(a.orden) || 0) - (Number(b.orden) || 0));

  const todoGlosario = await almacen.leer('glosario');

  // 5. Construcción del contenido curricular estrictamente delimitado
  let temaTitulo = '';
  let contenidoCurricular = '';

  if (temaId) {
    const temaEspecifico = temasPublicados.find((t) => t.id === temaId);
    if (!temaEspecifico) {
      throw Object.assign(new Error('El tema solicitado no existe o no pertenece a esta asignatura'), { estado: 404 });
    }
    const unidadDelTema = unidades.find((u) => u.id === temaEspecifico.unidadId);
    temaTitulo = `${temaEspecifico.titulo} (Unidad: ${unidadDelTema?.titulo || 'General'})`;

    const glosarioTema = todoGlosario.filter((g) => g.temaId === temaId && g.estado === 'aprobado');

    contenidoCurricular = `
ASIGNATURA: ${asignatura.nombre}
UNIDAD: ${unidadDelTema?.titulo || 'General'}
TEMA EN FOCO: ${temaEspecifico.titulo}

RESUMEN TÉCNICO:
${temaEspecifico.resumen || 'Sin resumen registrado.'}

OBJETIVOS DE APRENDIZAJE:
${(temaEspecifico.objetivos || []).map((o) => `• ${o}`).join('\n') || 'Ninguno especificado.'}

EJEMPLOS PRÁCTICOS EN OBRA / CAMPO:
${(temaEspecifico.ejemplos || []).map((e) => `• ${e}`).join('\n') || 'Ninguno especificado.'}

ERRORES CONCEPTUALES FRECUENTES A PREVENIR:
${(temaEspecifico.erroresFrecuentes || []).map((ef) => `• ${ef}`).join('\n') || 'Ninguno especificado.'}

PREGUNTAS ORIENTADORAS DOCENTES:
${(temaEspecifico.preguntasGuia || []).map((pg) => `• ${pg}`).join('\n') || 'Ninguna especificada.'}

CONCEPTOS Y GLOSARIO AUTORIZADO:
${glosarioTema.map((g) => `• ${g.termino}: ${g.definicion} (Pista: ${g.pista || 'N/A'})`).join('\n') || 'Ninguno registrado.'}

OTROS TEMAS CURRICULARES DE LA ASIGNATURA PARA RELACIONAR:
${temasPublicados.map((t) => `• ${t.titulo}`).join('\n')}
`.trim();
  } else {
    temaTitulo = `Todos los contenidos curriculares de ${asignatura.nombre}`;

    const bloquesCurriculares = unidades.map((unidad) => {
      const temasUnidad = temasPublicados.filter((t) => t.unidadId === unidad.id);
      const temasTexto = temasUnidad.map((t) => {
        const glosarioTema = todoGlosario.filter((g) => g.temaId === t.id && g.estado === 'aprobado');
        const terminos = glosarioTema.map((g) => g.termino).join(', ');
        return `
  - TEMA: ${t.titulo}
    * Resumen: ${t.resumen || ''}
    * Objetivos: ${(t.objetivos || []).join(' | ')}
    * Ejemplos: ${(t.ejemplos || []).join(' | ')}
    * Errores a evitar: ${(t.erroresFrecuentes || []).join(' | ')}
    * Conceptos clave: ${terminos || (t.palabrasClave || []).join(', ')}
        `.trim();
      }).join('\n\n');

      return `UNIDAD: ${unidad.titulo}\n${temasTexto || '  (Sin temas publicados)'}`;
    }).join('\n\n====================\n\n');

    contenidoCurricular = `
ASIGNATURA: ${asignatura.nombre}
DESCRIPCIÓN CURRICULAR: ${asignatura.descripcion || ''}
NIVEL ACADÉMICO: ${asignatura.nivel || 'Educación Superior'}

ESTRUCTURA DE UNIDADES Y TEMAS OFICIALES:
${bloquesCurriculares}
`.trim();
  }

  // 6. Formatear historial conversacional previo
  let historialTexto = 'Inicio de la sesión socrática.';
  if (Array.isArray(cuerpo.historial) && cuerpo.historial.length > 0) {
    // Tomar los últimos 8 turnos para mantener contexto preciso
    const ultimosTurnos = cuerpo.historial.slice(-8);
    historialTexto = ultimosTurnos
      .map((t) => {
        const rol = (t.rol === 'estudiante' || t.emisor === 'estudiante') ? 'Estudiante' : 'Tutor Socrático';
        const txt = (t.texto || t.mensaje || '').trim();
        return `${rol}: ${txt}`;
      })
      .filter((linea) => linea.length > 15)
      .join('\n');
  }

  // 7. Registrar / actualizar conteo en consultas-tutor
  try {
    const registroExistente = consultasHoy.find((c) =>
      c.asignaturaId === asignaturaId && (c.temaId || 'general') === (temaId || 'general')
    );

    if (registroExistente) {
      await almacen.actualizar('consultas-tutor', registroExistente.id, {
        mensajes: (Number(registroExistente.mensajes) || 1) + 1,
        fecha: new Date().toISOString()
      });
    } else {
      await almacen.agregar('consultas-tutor', {
        usuarioId: usuario.id,
        asignaturaId,
        temaId: temaId || 'general',
        dia: hoy,
        mensajes: 1,
        fecha: new Date().toISOString()
      });
    }
  } catch (errRegistro) {
    console.warn('Aviso al registrar consulta del tutor:', errRegistro.message);
  }

  return {
    asignatura: asignatura.nombre,
    nivel: asignatura.nivel || 'Educación Superior',
    tema: temaTitulo,
    contenido: contenidoCurricular,
    historial: historialTexto,
    pregunta
  };
}
