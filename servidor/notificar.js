// servidor/notificar.js · Sistema de notificaciones internas
import * as almacen from './almacen.js';

/**
 * Registra una nueva notificación para un usuario
 * @param {string} usuarioId - ID del destinatario
 * @param {Object} datos - { tipo, mensaje, enlace }
 * @returns {Promise<Object|null>}
 */
export async function notificar(usuarioId, { tipo = 'sistema', mensaje, enlace = null }) {
  if (!usuarioId || !mensaje) return null;

  return await almacen.agregar('notificaciones', {
    usuarioId,
    tipo,
    mensaje,
    enlace,
    leida: false
  });
}

export default {
  notificar
};
