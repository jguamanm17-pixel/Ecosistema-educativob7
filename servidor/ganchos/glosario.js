// servidor/ganchos/glosario.js · Ganchos para la colección glosario
import * as almacen from '../almacen.js';
import { asignaturasDe, asignaturaDeTema, puedeEditarAsignatura } from '../acceso.js';

/**
 * Filtra los términos de glosario según las asignaturas del usuario y aprobación para estudiantes
 * @param {Array} lista - Lista completa de términos de glosario
 * @param {Object|null} usuario - Usuario en sesión
 * @returns {Promise<Array>}
 */
export async function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista) || !usuario) return [];
  if (usuario.rol === 'admin') return lista;

  const temas = await almacen.leer('temas');
  const unidades = await almacen.leer('unidades');

  const mapaUnidades = new Map(unidades.map((u) => [u.id, u.asignaturaId]));
  const mapaTemas = new Map(temas.map((t) => [t.id, mapaUnidades.get(t.unidadId)]));

  const misAsignaturas = await asignaturasDe(usuario);
  const misIds = new Set(misAsignaturas.map((a) => a.id));

  return lista.filter((termino) => {
    const asignaturaId = mapaTemas.get(termino.temaId);
    if (!asignaturaId || !misIds.has(asignaturaId)) return false;

    if (usuario.rol === 'estudiante' && termino.estado !== 'aprobado' && termino.estado !== true) {
      return false;
    }

    return true;
  });
}

/**
 * Valida permisos de edición sobre la asignatura a la que pertenece el término
 * @param {Object} datos - Datos a guardar
 * @param {Object|null} usuario - Usuario en sesión
 * @param {Object|null} anterior - Registro anterior si es actualización
 * @returns {Promise<Object>}
 */
export async function antesDeGuardar(datos, usuario, anterior) {
  const temaId = datos.temaId || (anterior && anterior.temaId);
  const asignaturaId = await asignaturaDeTema(temaId);

  const permitido = await puedeEditarAsignatura(usuario, asignaturaId);
  if (!permitido) {
    throw Object.assign(
      new Error('No tienes permiso para editar términos de esta asignatura'),
      { estado: 403 }
    );
  }

  return datos;
}

export default {
  filtrarLista,
  antesDeGuardar
};
