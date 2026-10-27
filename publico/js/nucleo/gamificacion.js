// publico/js/nucleo/gamificacion.js · Cliente del motor de gamificación
import * as api from './api.js';
import * as ui from './ui.js';

/**
 * Registra un intento de actividad en el servidor
 * @param {Object} datos - { actividad, temaId, nivel, puntaje, maximo, errores, duracionSeg, detalle }
 * @returns {Promise<{ puntosGanados: number, puntosTotales: number, insigniasNuevas: Array }>}
 */
export async function registrarIntento(datos) {
  return await api.llamar('POST', '/api/intentos', datos);
}

/**
 * Muestra visualmente las recompensas obtenidas (puntos e insignias)
 * @param {Object} resultado - { puntosGanados, insigniasNuevas }
 */
export function mostrarLogros(resultado) {
  if (!resultado) return;

  const puntos = Number(resultado.puntosGanados) || 0;
  const insignias = Array.isArray(resultado.insigniasNuevas) ? resultado.insigniasNuevas : [];

  if (puntos > 0) {
    ui.aviso(`🎉 ¡Has ganado +${puntos} puntos de experiencia!`, 'exito');
  }

  if (insignias.length > 0) {
    insignias.forEach((ins) => {
      const contenedor = document.createElement('div');
      contenedor.className = 'pila';
      contenedor.style.gap = 'var(--espacio-s)';
      contenedor.style.textAlign = 'center';

      const icono = document.createElement('div');
      icono.style.fontSize = '3rem';
      icono.textContent = ins.icono || '🏆';
      contenedor.appendChild(icono);

      const nombre = document.createElement('h3');
      nombre.style.color = 'var(--color-primario)';
      nombre.style.marginBottom = 'var(--espacio-xs)';
      nombre.textContent = ins.nombre || 'Nueva insignia';
      contenedor.appendChild(nombre);

      const descripcion = document.createElement('p');
      descripcion.style.fontSize = 'var(--tamano-s)';
      descripcion.style.color = 'var(--color-texto-suave)';
      descripcion.textContent = ins.descripcion || '';
      contenedor.appendChild(descripcion);

      ui.modal({
        titulo: '¡Nueva insignia desbloqueada!',
        contenido: contenedor,
        acciones: [{ texto: '¡Genial!', valor: true, clase: 'btn-primario' }]
      });
    });
  }
}

/**
 * Consulta los logros de un usuario
 * @param {string} [usuarioId="yo"]
 * @returns {Promise<{ puntos: number, insignias: Array, nivelQuiz: Object }>}
 */
export async function logrosDe(usuarioId = 'yo') {
  return await api.llamar('GET', `/api/logros/${usuarioId}`);
}

export default {
  registrarIntento,
  mostrarLogros,
  logrosDe
};
