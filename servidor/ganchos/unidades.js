// servidor/ganchos/unidades.js · Ganchos para la colección unidades
import { asignaturasDe, puedeEditarAsignatura } from '../acceso.js';

/**
 * Filtra las unidades visibles según las asignaturas del usuario y visibilidad para estudiantes
 * @param {Array} lista - Lista completa de unidades
 * @param {Object|null} usuario - Usuario en sesión
 * @returns {Promise<Array>}
 */
export async function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista) || !usuario) return [];
  if (usuario.rol === 'admin') return lista;

  const misAsignaturas = await asignaturasDe(usuario);
  const misIds = new Set(misAsignaturas.map((a) => a.id));

  return lista.filter((unidad) => {
    if (!misIds.has(unidad.asignaturaId)) return false;
    if (usuario.rol === 'estudiante' && unidad.visible === false) return false;
    return true;
  });
}

/**
 * Valida permisos de edición sobre la asignatura antes de guardar la unidad
 * @param {Object} datos - Datos a guardar
 * @param {Object|null} usuario - Usuario en sesión
 * @param {Object|null} anterior - Registro anterior si es actualización
 * @returns {Promise<Object>}
 */
export async function antesDeGuardar(datos, usuario, anterior) {
  const asignaturaId = datos.asignaturaId || (anterior && anterior.asignaturaId);
  const permitido = await puedeEditarAsignatura(usuario, asignaturaId);

  if (!permitido) {
    throw Object.assign(
      new Error('No tienes permiso para editar unidades de esta asignatura'),
      { estado: 403 }
    );
  }

  return datos;
}

export default {
  filtrarLista,
  antesDeGuardar
};
