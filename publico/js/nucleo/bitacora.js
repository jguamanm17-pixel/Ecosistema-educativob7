// publico/js/nucleo/bitacora.js · Registro de eventos de auditoría y navegación
import * as api from './api.js';

/**
 * Registra un evento en la bitácora del sistema sin bloquear la ejecución
 * @param {string} tipo - Tipo de evento (ej: 'pagina', 'clic', 'actividad')
 * @param {string} recurso - Identificador o ruta del recurso involucrado
 */
export function registrarEvento(tipo, recurso) {
  api.llamar('POST', '/api/eventos', { tipo, recurso }).catch((error) => {
    // Los fallos de bitácora no interrumpen la experiencia del usuario
    console.debug('Error registrando evento en bitácora:', error.message);
  });
}
