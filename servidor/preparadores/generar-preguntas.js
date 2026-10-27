// servidor/preparadores/generar-preguntas.js · Preparador de datos para IA de preguntas
import * as almacen from '../almacen.js';
import { asignaturaDeTema, puedeEditarAsignatura } from '../acceso.js';

const NIVELES_BLOOM = {
  1: '1 Recordar',
  2: '2 Comprender',
  3: '3 Aplicar',
  4: '4 Analizar',
  5: '5 Evaluar'
};

/**
 * Prepara los datos del tema y la asignatura para la plantilla de generación de preguntas
 * @param {Object} cuerpo - { temaId, nivel, cantidad }
 * @param {Object} usuario - Usuario en sesión
 * @returns {Promise<Object>} Datos para sustituir en el prompt
 */
export default async function preparar(cuerpo, usuario) {
  if (!usuario) {
    throw Object.assign(new Error('Acceso no autorizado'), { estado: 401 });
  }

  const { temaId } = cuerpo;
  const nivel = Number(cuerpo.nivel);
  const cantidad = Number(cuerpo.cantidad);

  if (!temaId) {
    throw Object.assign(new Error('El parámetro temaId es obligatorio'), { estado: 400 });
  }

  if (isNaN(nivel) || nivel < 1 || nivel > 5) {
    throw Object.assign(new Error('El nivel cognitivo debe estar entre 1 y 5'), { estado: 400 });
  }

  if (isNaN(cantidad) || cantidad < 5 || cantidad > 15) {
    throw Object.assign(new Error('La cantidad de preguntas debe estar entre 5 y 15'), { estado: 400 });
  }

  // 1. Verificar tema y permisos de edición sobre la asignatura
  const temas = await almacen.leer('temas');
  const tema = temas.find((t) => t.id === temaId);
  if (!tema) {
    throw Object.assign(new Error('Tema no encontrado'), { estado: 404 });
  }

  const asignaturaId = await asignaturaDeTema(temaId);
  if (!asignaturaId) {
    throw Object.assign(new Error('No se pudo determinar la asignatura del tema'), { estado: 400 });
  }

  const permitido = await puedeEditarAsignatura(usuario, asignaturaId);
  if (!permitido) {
    throw Object.assign(
      new Error('No tienes permisos de edición sobre la asignatura a la que pertenece este tema'),
      { estado: 403 }
    );
  }

  // 2. Obtener datos de la asignatura
  const asignaturas = await almacen.leer('asignaturas');
  const asg = asignaturas.find((a) => a.id === asignaturaId);
  const asignaturaNombre = asg ? asg.nombre : 'Protección en la Construcción';
  const nivelEducativo = asg?.nivel || 'Educación Superior';

  // 3. Contenido del tema
  let contenido = tema.resumen || '';
  if (Array.isArray(tema.objetivos) && tema.objetivos.length > 0) {
    contenido += `\nObjetivos:\n${tema.objetivos.map((o) => `- ${o}`).join('\n')}`;
  }
  if (Array.isArray(tema.ejemplos) && tema.ejemplos.length > 0) {
    contenido += `\nEjemplos:\n${tema.ejemplos.map((e) => `- ${e}`).join('\n')}`;
  }

  // 4. Glosario del tema ("término: definición")
  const todoGlosario = await almacen.leer('glosario');
  const glosarioTema = todoGlosario.filter((g) => g.temaId === temaId && g.estado === 'aprobado');
  const glosarioTexto = glosarioTema.length > 0
    ? glosarioTema.map((g) => `${g.termino}: ${g.definicion}`).join('\n')
    : 'No hay términos de glosario registrados.';

  // 5. Preguntas ya existentes para este nivel y tema
  const todasPreguntas = await almacen.leer('preguntas');
  const existentes = todasPreguntas.filter(
    (p) => p.temaId === temaId && Number(p.nivel) === nivel
  );
  const existentesTexto = existentes.length > 0
    ? existentes.map((p) => `- ${p.enunciado}`).join('\n')
    : 'Ninguna';

  return {
    asignatura: asignaturaNombre,
    nivel: nivelEducativo,
    tema: tema.titulo,
    contenido,
    glosario: glosarioTexto,
    nivelBloom: NIVELES_BLOOM[nivel] || `${nivel} Bloom`,
    cantidad,
    existentes: existentesTexto
  };
}
