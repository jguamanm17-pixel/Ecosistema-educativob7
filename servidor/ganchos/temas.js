// servidor/ganchos/temas.js · Ganchos para la colección temas
import * as almacen from '../almacen.js';
import { asignaturasDe, puedeEditarAsignatura } from '../acceso.js';

/**
 * Filtra los temas visibles según asignaturas del usuario y estado publicado para estudiantes
 * @param {Array} lista - Lista completa de temas
 * @param {Object|null} usuario - Usuario en sesión
 * @returns {Promise<Array>}
 */
export async function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista) || !usuario) return [];
  if (usuario.rol === 'admin') return lista;

  const unidades = await almacen.leer('unidades');
  const mapaUnidades = new Map(unidades.map((u) => [u.id, u]));

  const misAsignaturas = await asignaturasDe(usuario);
  const misIds = new Set(misAsignaturas.map((a) => a.id));

  return lista.filter((tema) => {
    const unidad = mapaUnidades.get(tema.unidadId);
    if (!unidad || !misIds.has(unidad.asignaturaId)) return false;

    if (usuario.rol === 'estudiante') {
      if (unidad.visible === false) return false;
      if (tema.estado !== 'publicado') return false;
    }

    return true;
  });
}

/**
 * Valida permisos de edición sobre la asignatura a la que pertenece el tema
 * @param {Object} datos - Datos a guardar
 * @param {Object|null} usuario - Usuario en sesión
 * @param {Object|null} anterior - Registro anterior si es actualización
 * @returns {Promise<Object>}
 */
export async function antesDeGuardar(datos, usuario, anterior) {
  const unidadId = datos.unidadId || (anterior && anterior.unidadId);
  const unidades = await almacen.leer('unidades');
  const unidad = unidades.find((u) => u.id === unidadId);
  const asignaturaId = unidad ? unidad.asignaturaId : null;

  const permitido = await puedeEditarAsignatura(usuario, asignaturaId);
  if (!permitido) {
    throw Object.assign(
      new Error('No tienes permiso para editar temas de esta asignatura'),
      { estado: 403 }
    );
  }

  return datos;
}

export default {
  filtrarLista,
  antesDeGuardar
};
