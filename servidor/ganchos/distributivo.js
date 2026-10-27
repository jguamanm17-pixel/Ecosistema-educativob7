// servidor/ganchos/distributivo.js · Ganchos para la colección distributivo
import { gruposDe } from '../acceso.js';

/**
 * Filtra los grupos del distributivo según el rol y asignación del usuario
 * @param {Array} lista - Lista completa de distributivo
 * @param {Object|null} usuario - Usuario en sesión
 * @returns {Promise<Array>}
 */
export async function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista) || !usuario) return [];
  if (usuario.rol === 'admin') return lista;

  return gruposDe(usuario);
}

export default {
  filtrarLista
};
