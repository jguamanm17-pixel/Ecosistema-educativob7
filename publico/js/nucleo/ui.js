// publico/js/nucleo/ui.js · Componentes e interacción accesible de interfaz
/**
 * Escapa caracteres especiales de HTML para prevenir inyección de código
 * @param {string|any} texto - Texto a escapar
 * @returns {string} Texto seguro
 */
export function escapar(texto) {
  if (texto === null || texto === undefined) return '';
  return String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Sanitiza contenido HTML usando DOMPurify si está presente, o escapa por defecto
 * @param {string} html - Fragmento de HTML a limpiar
 * @returns {string} HTML seguro
 */
export function limpiar(html) {
  if (typeof window !== 'undefined' && window.DOMPurify && typeof window.DOMPurify.sanitize === 'function') {
    return window.DOMPurify.sanitize(html);
  }
  return escapar(html);
}

/**
 * Muestra un aviso flotante (toast) que se cierra automáticamente a los 4 segundos
 * @param {string} texto - Mensaje a mostrar
 * @param {'info'|'exito'|'error'} [tipo='info'] - Tipo visual de aviso
 */
export function aviso(texto, tipo = 'info') {
  if (typeof document === 'undefined') return;

  let contenedor = document.getElementById('contenedor-avisos');
  if (!contenedor) {
    contenedor = document.createElement('div');
    contenedor.id = 'contenedor-avisos';
    contenedor.className = 'contenedor-avisos';
    contenedor.setAttribute('aria-live', 'polite');
    document.body.appendChild(contenedor);
  }

  const elemento = document.createElement('div');
  elemento.className = `aviso aviso-${tipo}`;
  elemento.setAttribute('role', 'status');
  elemento.textContent = texto;

  contenedor.appendChild(elemento);

  setTimeout(() => {
    elemento.remove();
  }, 4000);
}

/**
 * Muestra u oculta el indicador visual de carga
 * @param {boolean} activo - true para mostrar, false para ocultar
 */
export function cargando(activo) {
  if (typeof document === 'undefined') return;

  let indicador = document.getElementById('indicador-cargando');
  if (activo) {
    if (!indicador) {
      indicador = document.createElement('div');
      indicador.id = 'indicador-cargando';
      indicador.className = 'cargando';
      indicador.setAttribute('role', 'status');
      indicador.setAttribute('aria-label', 'Cargando contenido...');
      document.body.appendChild(indicador);
    }
    indicador.hidden = false;
  } else if (indicador) {
    indicador.hidden = true;
    indicador.remove();
  }
}

/**
 * Muestra un diálogo modal accesible con foco atrapado y retorno por promesa
 * @param {Object} opciones
 * @param {string} opciones.titulo - Título del diálogo
 * @param {string} opciones.contenido - Contenido (texto o HTML simple seguro)
 * @param {Array<{texto: string, valor: any, clase?: string}>} [opciones.acciones] - Botones de acción
 * @returns {Promise<any|null>} Valor de la acción pulsada o null si se cancela con Esc o fondo
 */
export function modal({ titulo, contenido, acciones = [] }) {
  if (typeof document === 'undefined') return Promise.resolve(null);

  return new Promise((resolve) => {
    const focoPrevio = document.activeElement;

    // Crear overlay y caja del modal
    const overlay = document.createElement('div');
    overlay.className = 'modal-fondo';

    const dialogo = document.createElement('div');
    dialogo.className = 'modal';
    dialogo.setAttribute('role', 'dialog');
    dialogo.setAttribute('aria-modal', 'true');

    const idTitulo = `modal-titulo-${Date.now()}`;
    dialogo.setAttribute('aria-labelledby', idTitulo);

    // Encabezado
    const cabecera = document.createElement('header');
    cabecera.className = 'modal-cabecera';
    const h2 = document.createElement('h2');
    h2.id = idTitulo;
    h2.textContent = titulo;
    cabecera.appendChild(h2);

    // Cuerpo
    const cuerpo = document.createElement('div');
    cuerpo.className = 'modal-cuerpo';
    if (typeof contenido === 'string') {
      cuerpo.textContent = contenido;
    } else if (contenido instanceof HTMLElement) {
      cuerpo.appendChild(contenido);
    }

    // Pie con acciones
    const pie = document.createElement('footer');
    pie.className = 'modal-pie';

    const botones = [];
    const listaAcciones = acciones.length > 0 ? acciones : [{ texto: 'Aceptar', valor: true, clase: 'btn-primario' }];

    listaAcciones.forEach((acc) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `btn ${acc.clase || 'btn-secundario'}`;
      btn.textContent = acc.texto;
      btn.addEventListener('click', () => cerrar(acc.valor));
      pie.appendChild(btn);
      botones.push(btn);
    });

    dialogo.appendChild(cabecera);
    dialogo.appendChild(cuerpo);
    dialogo.appendChild(pie);
    overlay.appendChild(dialogo);
    document.body.appendChild(overlay);

    // Cierre y limpieza
    function cerrar(resultado) {
      document.removeEventListener('keydown', manejarTeclas);
      overlay.remove();
      if (focoPrevio && typeof focoPrevio.focus === 'function') {
        focoPrevio.focus();
      }
      resolve(resultado);
    }

    // Cierre al pulsar el fondo (fuera de la caja modal)
    overlay.addEventListener('click', (evento) => {
      if (evento.target === overlay) {
        cerrar(null);
      }
    });

    // Atrapar foco y gestionar tecla Escape
    function manejarTeclas(evento) {
      if (evento.key === 'Escape') {
        evento.preventDefault();
        cerrar(null);
        return;
      }

      if (evento.key === 'Tab') {
        const elementosFocales = dialogo.querySelectorAll(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (elementosFocales.length === 0) {
          evento.preventDefault();
          return;
        }

        const primero = elementosFocales[0];
        const ultimo = elementosFocales[elementosFocales.length - 1];

        if (evento.shiftKey) {
          if (document.activeElement === primero) {
            evento.preventDefault();
            ultimo.focus();
          }
        } else {
          if (document.activeElement === ultimo) {
            evento.preventDefault();
            primero.focus();
          }
        }
      }
    }

    document.addEventListener('keydown', manejarTeclas);

    // Enfoque inicial en el primer botón de acción
    if (botones.length > 0) {
      botones[0].focus();
    } else {
      dialogo.setAttribute('tabindex', '-1');
      dialogo.focus();
    }
  });
}

/**
 * Solicita confirmación al usuario mediante un diálogo modal accesible
 * @param {string} texto - Pregunta o texto de confirmación
 * @returns {Promise<boolean>} true si confirma, false si cancela
 */
export async function confirmar(texto) {
  const resultado = await modal({
    titulo: 'Confirmación',
    contenido: texto,
    acciones: [
      { texto: 'Cancelar', valor: false, clase: 'btn-secundario' },
      { texto: 'Confirmar', valor: true, clase: 'btn-primario' }
    ]
  });
  return Boolean(resultado);
}
