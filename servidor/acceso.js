// servidor/acceso.js · Control de acceso académico y relaciones distributivas
import * as almacen from './almacen.js';

/**
 * Obtiene los grupos del distributivo correspondientes al usuario según su rol
 * @param {Object|null} usuario - Usuario en sesión
 * @returns {Promise<Array>} Lista de registros de distributivo
 */
export async function gruposDe(usuario) {
  if (!usuario) return [];

  const distributivo = await almacen.leer('distributivo');

  // Administrador ve todos los grupos
  if (usuario.rol === 'admin') {
    return distributivo;
  }

  // Docente ve los grupos donde está asignado
  if (usuario.rol === 'docente') {
    return distributivo.filter((d) => d.docenteId === usuario.id);
  }

  // Estudiante ve los grupos donde figura en la lista de estudiantes
  if (usuario.rol === 'estudiante') {
    return distributivo.filter(
      (d) => Array.isArray(d.estudiantes) && d.estudiantes.includes(usuario.id)
    );
  }

  return [];
}

/**
 * Obtiene las asignaturas a las que pertenece el usuario según su distributivo
 * @param {Object|null} usuario - Usuario en sesión
 * @returns {Promise<Array>} Lista de asignaturas
 */
export async function asignaturasDe(usuario) {
  if (!usuario) return [];

  const asignaturas = await almacen.leer('asignaturas');

  // Administrador ve todas las asignaturas
  if (usuario.rol === 'admin') {
    return asignaturas;
  }

  const grupos = await gruposDe(usuario);
  const idsAsignaturas = new Set(grupos.map((g) => g.asignaturaId).filter(Boolean));

  return asignaturas.filter((a) => idsAsignaturas.has(a.id));
}

/**
 * Resuelve la asignatura de un tema navegando tema → unidad → asignatura
 * @param {string} temaId - ID del tema
 * @returns {Promise<string|null>} ID de la asignatura o null
 */
export async function asignaturaDeTema(temaId) {
  if (!temaId) return null;

  const temas = await almacen.leer('temas');
  const tema = temas.find((t) => t.id === temaId);
  if (!tema || !tema.unidadId) return null;

  const unidades = await almacen.leer('unidades');
  const unidad = unidades.find((u) => u.id === tema.unidadId);
  if (!unidad || !unidad.asignaturaId) return null;

  return unidad.asignaturaId;
}

/**
 * Valida si un usuario tiene permisos de edición sobre una asignatura
 * @param {Object|null} usuario - Usuario en sesión
 * @param {string} asignaturaId - ID de la asignatura
 * @returns {Promise<boolean>}
 */
export async function puedeEditarAsignatura(usuario, asignaturaId) {
  if (!usuario || !asignaturaId) return false;

  // Administrador puede editar cualquier asignatura
  if (usuario.rol === 'admin') {
    return true;
  }

  // Docente solo si tiene la asignatura asignada en distributivo
  if (usuario.rol === 'docente') {
    const distributivo = await almacen.leer('distributivo');
    return distributivo.some(
      (d) => d.docenteId === usuario.id && d.asignaturaId === asignaturaId
    );
  }

  return false;
}

/**
 * Obtiene los IDs de los estudiantes a cargo de un docente
 * @param {string} docenteId - ID del docente
 * @returns {Promise<string[]>} Lista de IDs de estudiantes
 */
export async function estudiantesDe(docenteId) {
  if (!docenteId) return [];

  const distributivo = await almacen.leer('distributivo');
  const grupos = distributivo.filter((d) => d.docenteId === docenteId);

  const ids = new Set(grupos.flatMap((g) => g.estudiantes || []));
  return Array.from(ids);
}

/**
 * Obtiene los IDs de los docentes que imparten clases a un estudiante
 * @param {string} estudianteId - ID del estudiante
 * @returns {Promise<string[]>} Lista de IDs de docentes
 */
export async function docentesDe(estudianteId) {
  if (!estudianteId) return [];

  const distributivo = await almacen.leer('distributivo');
  const grupos = distributivo.filter(
    (d) => Array.isArray(d.estudiantes) && d.estudiantes.includes(estudianteId)
  );

  const ids = new Set(grupos.map((g) => g.docenteId).filter(Boolean));
  return Array.from(ids);
}

export default {
  gruposDe,
  asignaturasDe,
  asignaturaDeTema,
  puedeEditarAsignatura,
  estudiantesDe,
  docentesDe
};
