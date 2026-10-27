// publico/js/nucleo/util.js · Utilidades generales del cliente
/**
 * Normaliza un texto: mayúsculas, sin tildes ni diéresis, conservando la Ñ y sin espacios a los extremos
 * @param {string} texto - Texto original
 * @returns {string} Texto normalizado
 */
export function normalizar(texto) {
  if (texto === null || texto === undefined) return '';
  let s = String(texto).trim().toUpperCase();
  // Preservar la Ñ reemplazándola temporalmente
  s = s.replaceAll('Ñ', '\u0001');
  // Descomponer y eliminar marcas diacríticas (tildes, diéresis)
  s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  // Restaurar la Ñ
  s = s.replaceAll('\u0001', 'Ñ');
  return s;
}

/**
 * Baraja un arreglo utilizando el algoritmo de Fisher-Yates sin mutar el original
 * @template T
 * @param {T[]} lista - Arreglo original
 * @returns {T[]} Nuevo arreglo con los elementos en orden aleatorio
 */
export function barajar(lista) {
  if (!Array.isArray(lista)) return [];
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

/**
 * Formatea una fecha en formato ISO a fecha larga en español de Ecuador (ej: "24 de octubre de 2026")
 * @param {string} iso - Cadena de fecha en formato ISO
 * @returns {string} Fecha formateada
 */
export function fechaLarga(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('es-EC', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

/**
 * Devuelve una descripción de tiempo relativo en español de Ecuador (ej: "hace 5 minutos", "ayer")
 * @param {string} iso - Cadena de fecha en formato ISO
 * @returns {string} Tiempo relativo
 */
export function fechaRelativa(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';

  const seg = Math.round((d.getTime() - Date.now()) / 1000);
  const absSeg = Math.abs(seg);

  if (absSeg < 30) {
    return 'hace un momento';
  }

  const rtf = new Intl.RelativeTimeFormat('es-EC', { numeric: 'auto' });

  if (absSeg < 3600) {
    const min = Math.round(seg / 60);
    return rtf.format(min, 'minute');
  }
  if (absSeg < 86400) {
    const horas = Math.round(seg / 3600);
    return rtf.format(horas, 'hour');
  }
  if (absSeg < 2592000) {
    const dias = Math.round(seg / 86400);
    return rtf.format(dias, 'day');
  }
  if (absSeg < 31536000) {
    const meses = Math.round(seg / 2592000);
    return rtf.format(meses, 'month');
  }

  const anios = Math.round(seg / 31536000);
  return rtf.format(anios, 'year');
}

/**
 * Obtiene el valor de un parámetro en la URL actual (query string)
 * @param {string} nombre - Nombre del parámetro
 * @returns {string|null} Valor del parámetro o null si no existe
 */
export function parametro(nombre) {
  if (typeof window === 'undefined' || !window.location) return null;
  const params = new URLSearchParams(window.location.search);
  return params.get(nombre);
}

/**
 * Escapa el texto y aplica formato básico seguro:
 * - Convierte **texto** en <strong>
 * - Convierte líneas con "- " en listas <ul><li>
 * - Convierte bloques separados por línea en blanco en párrafos <p>
 * @param {string} texto - Texto sin formato
 * @returns {string} HTML seguro con formato
 */
export function formatoBasico(texto) {
  if (texto === null || texto === undefined) return '';

  // 1. Escapar caracteres especiales
  let seguro = String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  // 2. Negrita **texto**
  seguro = seguro.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // 3. Separar por bloques mediante líneas en blanco
  const bloques = seguro
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);

  if (bloques.length === 0) return '';

  const resultado = bloques.map((bloque) => {
    const lineas = bloque.split('\n').map((l) => l.trim()).filter(Boolean);
    const contieneItems = lineas.some((l) => l.startsWith('- '));

    if (!contieneItems) {
      return `<p>${bloque.replace(/\n/g, '<br>')}</p>`;
    }

    let html = '';
    let enLista = false;

    for (const linea of lineas) {
      if (linea.startsWith('- ')) {
        if (!enLista) {
          html += '<ul>';
          enLista = true;
        }
        html += `<li>${linea.slice(2).trim()}</li>`;
      } else {
        if (enLista) {
          html += '</ul>';
          enLista = false;
        }
        html += `<p>${linea}</p>`;
      }
    }

    if (enLista) {
      html += '</ul>';
    }

    return html;
  });

  return resultado.join('');
}
