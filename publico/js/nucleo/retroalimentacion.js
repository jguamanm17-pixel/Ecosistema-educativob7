// publico/js/nucleo/retroalimentacion.js · Retroalimentación formativa y resúmenes de actividades
import * as ui from './ui.js';

/**
 * Muestra la retroalimentación inmediata de una pregunta o acción
 * @param {Object} opciones
 * @param {boolean} opciones.correcto - Indica si la respuesta fue correcta
 * @param {string} [opciones.explicacion] - Explicación pedagógica de la respuesta
 * @param {string} [opciones.sugerencia] - Pista o recomendación formativa
 * @param {string} [opciones.enlaceTema] - Enlace URL para repasar el contenido
 * @returns {Promise<boolean>}
 */
export async function mostrarRetro({ correcto, explicacion, sugerencia, enlaceTema }) {
  const contenedor = document.createElement('div');
  contenedor.className = 'pila';
  contenedor.style.gap = 'var(--espacio-m)';

  const encabezado = document.createElement('div');
  encabezado.style.display = 'flex';
  encabezado.style.alignItems = 'center';
  encabezado.style.gap = 'var(--espacio-s)';
  encabezado.style.padding = 'var(--espacio-m)';
  encabezado.style.borderRadius = 'var(--radio-m)';
  encabezado.style.backgroundColor = correcto ? 'var(--color-exito-fondo)' : 'var(--color-error-fondo)';
  encabezado.style.color = correcto ? 'var(--color-exito)' : 'var(--color-error)';
  encabezado.style.border = `1px solid ${correcto ? 'var(--color-exito)' : 'var(--color-error)'}`;

  const icono = document.createElement('span');
  icono.style.fontSize = 'var(--tamano-xl)';
  icono.textContent = correcto ? '✓' : '✕';
  encabezado.appendChild(icono);

  const titulo = document.createElement('strong');
  titulo.style.fontSize = 'var(--tamano-l)';
  titulo.textContent = correcto ? '¡Respuesta correcta!' : 'Respuesta incorrecta';
  encabezado.appendChild(titulo);

  contenedor.appendChild(encabezado);

  if (explicacion && explicacion.trim()) {
    const pExplicacion = document.createElement('p');
    pExplicacion.style.fontSize = 'var(--tamano-m)';
    pExplicacion.style.lineHeight = 'var(--interlineado-base)';
    pExplicacion.innerHTML = `<strong>Explicación:</strong> ${ui.escapar(explicacion)}`;
    contenedor.appendChild(pExplicacion);
  }

  if (sugerencia && sugerencia.trim()) {
    const pSugerencia = document.createElement('p');
    pSugerencia.style.fontSize = 'var(--tamano-s)';
    pSugerencia.style.color = 'var(--color-texto-suave)';
    pSugerencia.innerHTML = `💡 <em>${ui.escapar(sugerencia)}</em>`;
    contenedor.appendChild(pSugerencia);
  }

  if (enlaceTema) {
    const pEnlace = document.createElement('p');
    pEnlace.innerHTML = `<a href="${ui.escapar(enlaceTema)}" target="_blank" rel="noopener">📖 Repasar contenido en el tema</a>`;
    contenedor.appendChild(pEnlace);
  }

  return await ui.modal({
    titulo: 'Retroalimentación',
    contenido: contenedor,
    acciones: [
      { texto: 'Siguiente pregunta →', valor: true, clase: 'btn-primario' }
    ]
  });
}

/**
 * Muestra el resumen cuantitativo y formativo al terminar una actividad
 * @param {Object} opciones
 * @param {string} opciones.titulo - Título del resumen
 * @param {number} opciones.aciertos - Cantidad de respuestas correctas
 * @param {number} opciones.errores - Cantidad de respuestas incorrectas
 * @param {Array<string>} [opciones.recomendaciones] - Lista de conceptos a repasar
 * @param {string} [opciones.enlaceTema] - Enlace URL al tema
 * @returns {Promise<"repetir" | "salir">}
 */
export async function mostrarResumen({ titulo, aciertos, errores, recomendaciones = [], enlaceTema = null }) {
  const total = (Number(aciertos) || 0) + (Number(errores) || 0);
  const porcentaje = total > 0 ? Math.round(((Number(aciertos) || 0) / total) * 100) : 0;

  const contenedor = document.createElement('div');
  contenedor.className = 'pila';
  contenedor.style.gap = 'var(--espacio-m)';

  // Tarjetas de métricas
  const gridMetricas = document.createElement('div');
  gridMetricas.style.display = 'grid';
  gridMetricas.style.gridTemplateColumns = 'repeat(3, 1fr)';
  gridMetricas.style.gap = 'var(--espacio-s)';
  gridMetricas.style.textAlign = 'center';

  const cardAciertos = document.createElement('div');
  cardAciertos.style.padding = 'var(--espacio-s)';
  cardAciertos.style.backgroundColor = 'var(--color-exito-fondo)';
  cardAciertos.style.borderRadius = 'var(--radio-m)';
  cardAciertos.innerHTML = `<span style="font-size: var(--tamano-xs); color: var(--color-exito);">Aciertos</span><br><strong style="font-size: var(--tamano-xl); color: var(--color-exito);">${aciertos}</strong>`;

  const cardErrores = document.createElement('div');
  cardErrores.style.padding = 'var(--espacio-s)';
  cardErrores.style.backgroundColor = 'var(--color-error-fondo)';
  cardErrores.style.borderRadius = 'var(--radio-m)';
  cardErrores.innerHTML = `<span style="font-size: var(--tamano-xs); color: var(--color-error);">Errores</span><br><strong style="font-size: var(--tamano-xl); color: var(--color-error);">${errores}</strong>`;

  const cardPct = document.createElement('div');
  cardPct.style.padding = 'var(--espacio-s)';
  cardPct.style.backgroundColor = 'var(--color-info-fondo)';
  cardPct.style.borderRadius = 'var(--radio-m)';
  cardPct.innerHTML = `<span style="font-size: var(--tamano-xs); color: var(--color-info);">Rendimiento</span><br><strong style="font-size: var(--tamano-xl); color: var(--color-info);">${porcentaje}%</strong>`;

  gridMetricas.appendChild(cardAciertos);
  gridMetricas.appendChild(cardErrores);
  gridMetricas.appendChild(cardPct);
  contenedor.appendChild(gridMetricas);

  // Recomendaciones / retroalimentaciones a repasar
  if (Array.isArray(recomendaciones) && recomendaciones.length > 0) {
    const bloqueRepaso = document.createElement('div');
    bloqueRepaso.style.backgroundColor = 'var(--color-fondo)';
    bloqueRepaso.style.padding = 'var(--espacio-m)';
    bloqueRepaso.style.borderRadius = 'var(--radio-m)';

    const h4 = document.createElement('h4');
    h4.style.fontSize = 'var(--tamano-s)';
    h4.style.color = 'var(--color-primario)';
    h4.style.marginBottom = 'var(--espacio-xs)';
    h4.textContent = '📌 Conceptos y puntos clave a repasar:';
    bloqueRepaso.appendChild(h4);

    const ul = document.createElement('ul');
    ul.style.paddingLeft = 'var(--espacio-l)';
    ul.style.fontSize = 'var(--tamano-xs)';
    ul.style.display = 'flex';
    ul.style.flexDirection = 'column';
    ul.style.gap = 'var(--espacio-xs)';

    recomendaciones.forEach((rec) => {
      const li = document.createElement('li');
      li.textContent = rec;
      ul.appendChild(li);
    });
    bloqueRepaso.appendChild(ul);
    contenedor.appendChild(bloqueRepaso);
  }

  if (enlaceTema) {
    const divTema = document.createElement('div');
    divTema.style.textAlign = 'center';
    divTema.innerHTML = `<a href="${ui.escapar(enlaceTema)}" target="_blank" rel="noopener" class="btn btn--texto">📖 Repasar ficha completa del tema</a>`;
    contenedor.appendChild(divTema);
  }

  const accionElegida = await ui.modal({
    titulo: titulo || 'Resumen de la actividad',
    contenido: contenedor,
    acciones: [
      { texto: 'Repetir nivel', valor: 'repetir', clase: 'btn-secundario' },
      { texto: 'Continuar', valor: 'salir', clase: 'btn-primario' }
    ]
  });

  return accionElegida || 'salir';
}

export default {
  mostrarRetro,
  mostrarResumen
};
