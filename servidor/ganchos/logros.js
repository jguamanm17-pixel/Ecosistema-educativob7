// servidor/ganchos/logros.js · Ganchos para la colección logros
import { estudiantesDe } from '../acceso.js';

/**
 * Filtra los logros de los usuarios según su rol
 * @param {Array} lista - Lista completa de logros
 * @param {Object|null} usuario - Usuario en sesión
 * @returns {Promise<Array>}
 */
export async function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista) || !usuario) return [];
  if (usuario.rol === 'admin') return lista;

  if (usuario.rol === 'docente') {
    const misEstudiantes = await estudiantesDe(usuario.id);
    const idsEstudiantes = new Set(misEstudiantes);
    return lista.filter((l) => idsEstudiantes.has(l.usuarioId));
  }

  if (usuario.rol === 'estudiante') {
    return lista.filter((l) => l.usuarioId === usuario.id);
  }

  return [];
}

export default {
  filtrarLista
};
