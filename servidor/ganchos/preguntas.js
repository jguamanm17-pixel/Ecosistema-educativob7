// servidor/ganchos/preguntas.js · Ganchos para la colección preguntas
import * as almacen from '../almacen.js';
import { asignaturasDe, asignaturaDeTema, puedeEditarAsignatura } from '../acceso.js';

/**
 * Filtra las preguntas según las asignaturas del docente (a través del tema)
 * @param {Array} lista - Lista de preguntas
 * @param {Object|null} usuario - Usuario en sesión
 * @returns {Promise<Array>}
 */
export async function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista) || !usuario) return [];
  if (usuario.rol === 'admin') return lista;
  if (usuario.rol !== 'docente') return [];

  const misAsignaturas = await asignaturasDe(usuario);
  const misAsigIds = new Set(misAsignaturas.map((a) => a.id));

  const temas = await almacen.leer('temas');
  const unidades = await almacen.leer('unidades');

  const mapaUnidadAsignatura = new Map(unidades.map((u) => [u.id, u.asignaturaId]));
  const mapaTemaAsignatura = new Map(
    temas.map((t) => [t.id, mapaUnidadAsignatura.get(t.unidadId)])
  );

  return lista.filter((pregunta) => {
    const asgId = mapaTemaAsignatura.get(pregunta.temaId);
    return asgId && misAsigIds.has(asgId);
  });
}

/**
 * Valida permisos de edición sobre la asignatura y estructura de la pregunta antes de guardar
 * @param {Object} datos - Datos a guardar
 * @param {Object|null} usuario - Usuario en sesión
 * @param {Object|null} anterior - Registro previo en actualización
 * @returns {Promise<Object>}
 */
export async function antesDeGuardar(datos, usuario, anterior) {
  if (!usuario) {
    throw Object.assign(new Error('Acceso no autorizado'), { estado: 401 });
  }

  if (usuario.rol !== 'docente' && usuario.rol !== 'admin') {
    throw Object.assign(new Error('No tienes permisos para crear o editar preguntas'), { estado: 403 });
  }

  const temaId = datos.temaId || (anterior && anterior.temaId);
  if (!temaId) {
    throw Object.assign(new Error('El campo temaId es obligatorio'), { estado: 400 });
  }

  // Verificar pertenencia y permisos sobre la asignatura
  const asignaturaId = await asignaturaDeTema(temaId);
  if (!asignaturaId) {
    throw Object.assign(new Error('No se pudo determinar la asignatura a la que pertenece el tema'), { estado: 400 });
  }

  const permitido = await puedeEditarAsignatura(usuario, asignaturaId);
  if (!permitido) {
    throw Object.assign(
      new Error('No tienes permisos de edición sobre la asignatura de esta pregunta'),
      { estado: 403 }
    );
  }

  // Validaciones del cuerpo de la pregunta
  const enunciado = datos.enunciado !== undefined ? datos.enunciado : (anterior && anterior.enunciado);
  if (!enunciado || typeof enunciado !== 'string' || !enunciado.trim()) {
    throw Object.assign(new Error('El enunciado de la pregunta es obligatorio'), { estado: 400 });
  }

  const tipo = datos.tipo || (anterior && anterior.tipo) || 'opcion';
  if (!['opcion', 'vf', 'completar'].includes(tipo)) {
    throw Object.assign(new Error('El tipo de pregunta debe ser "opcion", "vf" o "completar"'), { estado: 400 });
  }

  const nivel = Number(datos.nivel !== undefined ? datos.nivel : (anterior && anterior.nivel));
  if (isNaN(nivel) || nivel < 1 || nivel > 5) {
    throw Object.assign(new Error('El nivel cognitivo debe ser un número entero entre 1 y 5'), { estado: 400 });
  }

  // Limpieza y normalización de datos
  datos.temaId = temaId;
  datos.enunciado = enunciado.trim();
  datos.tipo = tipo;
  datos.nivel = nivel;

  const retro = datos.retroalimentacion !== undefined ? datos.retroalimentacion : (anterior && anterior.retroalimentacion);
  datos.retroalimentacion = (retro || '').trim();

  const origen = datos.origen || (anterior && anterior.origen);
  datos.origen = origen === 'ia' ? 'ia' : 'docente';

  const estado = datos.estado || (anterior && anterior.estado);
  datos.estado = estado === 'borrador' ? 'borrador' : 'aprobado';

  // Validación de opciones y correcta según tipo
  if (tipo === 'opcion') {
    const opciones = datos.opciones !== undefined ? datos.opciones : (anterior && anterior.opciones);
    if (!Array.isArray(opciones) || opciones.length < 2) {
      throw Object.assign(new Error('Las preguntas de opción deben tener al menos dos opciones'), { estado: 400 });
    }
    datos.opciones = opciones.map((o) => String(o).trim());

    const correctaVal = datos.correcta !== undefined ? datos.correcta : (anterior && anterior.correcta);
    datos.correcta = Number(correctaVal);
    if (isNaN(datos.correcta) || datos.correcta < 0 || datos.correcta >= datos.opciones.length) {
      throw Object.assign(new Error('El índice de la opción correcta es inválido'), { estado: 400 });
    }
  } else if (tipo === 'vf') {
    datos.opciones = ['Verdadero', 'Falso'];
    const correctaVal = datos.correcta !== undefined ? datos.correcta : (anterior && anterior.correcta);
    datos.correcta = correctaVal === true || String(correctaVal).toLowerCase() === 'true' || correctaVal === 0;
  } else if (tipo === 'completar') {
    datos.opciones = [];
    const correctaVal = datos.correcta !== undefined ? datos.correcta : (anterior && anterior.correcta);
    if (!correctaVal || typeof correctaVal !== 'string' || !correctaVal.trim()) {
      throw Object.assign(new Error('La respuesta correcta para completar es obligatoria'), { estado: 400 });
    }
    datos.correcta = correctaVal.trim();
  }

  return datos;
}

export default {
  filtrarLista,
  antesDeGuardar
};
