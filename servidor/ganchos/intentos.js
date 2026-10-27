// servidor/ganchos/intentos.js · Ganchos para la colección intentos
import { estudiantesDe } from '../acceso.js';

/**
 * Filtra los intentos de actividades según el rol del usuario en sesión
 * @param {Array} lista - Lista completa de intentos
 * @param {Object|null} usuario - Usuario en sesión
 * @returns {Promise<Array>}
 */
export async function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista) || !usuario) return [];
  if (usuario.rol === 'admin') return lista;

  if (usuario.rol === 'docente') {
    const misEstudiantes = await estudiantesDe(usuario.id);
    const idsEstudiantes = new Set(misEstudiantes);
    return lista.filter((i) => idsEstudiantes.has(i.usuarioId));
  }

  if (usuario.rol === 'estudiante') {
    return lista.filter((i) => i.usuarioId === usuario.id);
  }

  return [];
}

export default {
  filtrarLista
};
