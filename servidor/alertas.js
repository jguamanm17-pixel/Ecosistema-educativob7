// servidor/alertas.js · Detección y gestión de alertas tempranas
/**
 * Evalúa las alertas tras registrar un intento
 * @param {Object} intento - Intento registrado
 * @param {Object} usuario - Usuario que realizó el intento
 * @returns {Promise<void>}
 */
export async function evaluarAlertas(intento, usuario) {
  // Se completa en el módulo de alertas (Sprint posterior)
}

/**
 * Evalúa inactividad de estudiantes en un grupo
 * @param {string} grupoId - ID del grupo en distributivo
 * @returns {Promise<void>}
 */
export async function evaluarInactividad(grupoId) {
  // Se completa en el módulo de alertas
}

export default {
  evaluarAlertas,
  evaluarInactividad
};
