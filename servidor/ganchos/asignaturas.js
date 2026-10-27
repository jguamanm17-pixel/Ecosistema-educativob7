// servidor/ganchos/asignaturas.js · Ganchos para la colección asignaturas
import { asignaturasDe } from '../acceso.js';

/**
 * Filtra las asignaturas visibles según el distributivo del usuario
 * @param {Array} lista - Lista completa de asignaturas
 * @param {Object|null} usuario - Usuario en sesión
 * @returns {Promise<Array>}
 */
export async function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista) || !usuario) return [];
  if (usuario.rol === 'admin') return lista;

  const misAsignaturas = await asignaturasDe(usuario);
  const misIds = new Set(misAsignaturas.map((a) => a.id));

  return lista.filter((a) => misIds.has(a.id));
}

export default {
  filtrarLista
};
