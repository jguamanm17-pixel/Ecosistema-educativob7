// servidor/ganchos.js · Carga y ejecución de ganchos de ciclo de vida por colección
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const RUTA_GANCHOS = path.resolve('servidor', 'ganchos');
const ganchos = new Map();

/**
 * Carga todos los módulos .js en servidor/ganchos/
 */
export async function cargarGanchos() {
  try {
    const archivos = await fs.readdir(RUTA_GANCHOS);
    for (const archivo of archivos) {
      if (archivo.endsWith('.js')) {
        const col = path.basename(archivo, '.js');
        const urlModulo = pathToFileURL(path.join(RUTA_GANCHOS, archivo)).href;
        const modulo = await import(urlModulo);
        ganchos.set(col, modulo.default || modulo);
      }
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('Error cargando ganchos:', error.message);
    }
  }
}

// Carga al iniciar el módulo
await cargarGanchos();

/**
 * Aplica un gancho sobre una colección si existe, o retorna el primer argumento
 * @param {string} col - Nombre de la colección
 * @param {'filtrarLista'|'antesDeGuardar'|'despuesDeGuardar'} nombre - Nombre de la función del gancho
 * @param {...any} args - Argumentos recibidos por el gancho
 * @returns {Promise<any>}
 */
export async function aplicar(col, nombre, ...args) {
  const nombreBase = col.split('/')[0];
  let gancho = ganchos.get(col) || ganchos.get(nombreBase);
  if (!gancho) {
    await cargarGanchos();
    gancho = ganchos.get(col) || ganchos.get(nombreBase);
  }

  if (!gancho || typeof gancho[nombre] !== 'function') {
    return args[0];
  }

  return await gancho[nombre](...args);
}
