// servidor/almacen.js · Almacenamiento seguro en archivos JSON y JSONL
import fs from 'node:fs/promises';
import path from 'node:path';

const RUTA_DATOS = path.resolve('datos');
const RUTA_RESPALDOS = path.resolve(RUTA_DATOS, 'respaldos');
const colasPorArchivo = new Map();

// Valida que el nombre de colección solo contenga caracteres permitidos
function validarNombre(col) {
  if (typeof col !== 'string') {
    throw Object.assign(new Error('Nombre de colección inválido'), { estado: 400 });
  }
  const regex = /^[a-z0-9-]+(\/[a-z0-9_-]+)?$/;
  if (!regex.test(col)) {
    throw Object.assign(new Error(`Nombre de colección no permitido: "${col}"`), { estado: 400 });
  }
}

// Obtiene la ruta física asegurando que permanezca dentro de datos/
function obtenerRuta(col) {
  validarNombre(col);
  const archivo = col.endsWith('.json') ? col : `${col}.json`;
  const rutaCompleta = path.resolve(RUTA_DATOS, archivo);
  if (!rutaCompleta.startsWith(RUTA_DATOS)) {
    throw Object.assign(new Error('Acceso a ruta fuera de datos no permitido'), { estado: 403 });
  }
  return rutaCompleta;
}

// Ejecuta una operación de escritura de forma secuencial por archivo
function encolar(ruta, accion) {
  const colaActual = colasPorArchivo.get(ruta) || Promise.resolve();
  const siguiente = colaActual.then(accion, accion);
  colasPorArchivo.set(ruta, siguiente);
  return siguiente.finally(() => {
    if (colasPorArchivo.get(ruta) === siguiente) {
      colasPorArchivo.delete(ruta);
    }
  });
}

// Realiza copia recursiva excluyendo la carpeta de respaldos
async function copiarDirectorio(origen, destino) {
  await fs.mkdir(destino, { recursive: true });
  const entradas = await fs.readdir(origen, { withFileTypes: true });
  for (const entrada of entradas) {
    const rutaOrigen = path.join(origen, entrada.name);
    const rutaDestino = path.join(destino, entrada.name);
    if (entrada.isDirectory()) {
      if (path.resolve(rutaOrigen) === RUTA_RESPALDOS) continue;
      await copiarDirectorio(rutaOrigen, rutaDestino);
    } else if (entrada.isFile()) {
      await fs.copyFile(rutaOrigen, rutaDestino);
    }
  }
}

// Copia datos/ en la primera escritura del día y retiene los 14 más recientes
async function asegurarRespaldoDiario() {
  const hoy = new Date().toISOString().slice(0, 10);
  const carpetaHoy = path.join(RUTA_RESPALDOS, hoy);

  try {
    await fs.access(carpetaHoy);
    return; // Ya existe el respaldo de hoy
  } catch {
    // Procede a crearlo
  }

  try {
    await fs.mkdir(RUTA_RESPALDOS, { recursive: true });
    await copiarDirectorio(RUTA_DATOS, carpetaHoy);

    // Limpieza de respaldos antiguos (> 14)
    const existentes = await fs.readdir(RUTA_RESPALDOS, { withFileTypes: true });
    const respaldos = existentes
      .filter((e) => e.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(e.name))
      .map((e) => e.name)
      .sort();

    if (respaldos.length > 14) {
      const aEliminar = respaldos.slice(0, respaldos.length - 14);
      for (const dir of aEliminar) {
        await fs.rm(path.join(RUTA_RESPALDOS, dir), { recursive: true, force: true });
      }
    }
  } catch (error) {
    console.error('Error al generar respaldo diario:', error.message);
  }
}

// Lee una colección completa en memoria; colección inexistente = []
export async function leer(col) {
  const ruta = obtenerRuta(col);
  try {
    const contenido = await fs.readFile(ruta, 'utf-8');
    return JSON.parse(contenido);
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

// Escribe una lista completa de registros en cola, primero a .tmp y luego renombra
export async function escribir(col, lista) {
  const ruta = obtenerRuta(col);
  return encolar(ruta, async () => {
    await asegurarRespaldoDiario();
    const carpeta = path.dirname(ruta);
    await fs.mkdir(carpeta, { recursive: true });
    const rutaTmp = `${ruta}.${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`;
    const json = JSON.stringify(lista, null, 2);
    await fs.writeFile(rutaTmp, json, 'utf-8');
    await fs.rename(rutaTmp, ruta);
  });
}

// Genera un ID con las 3 primeras letras de la colección + _ + número de 6 dígitos
function generarId(col, lista) {
  const nombreBase = col.split('/')[0].toLowerCase();
  const prefijo = nombreBase.slice(0, 3);
  const patron = new RegExp(`^${prefijo}_(\\d{6})$`);
  let maximo = 0;

  for (const item of lista) {
    if (item && typeof item.id === 'string') {
      const coincidencia = item.id.match(patron);
      if (coincidencia) {
        const num = parseInt(coincidencia[1], 10);
        if (num > maximo) maximo = num;
      }
    }
  }

  const siguiente = String(maximo + 1).padStart(6, '0');
  return `${prefijo}_${siguiente}`;
}

// Agrega un nuevo registro asignando ID y fecha ISO
export async function agregar(col, reg) {
  const lista = await leer(col);
  const nuevo = {
    ...reg,
    id: reg.id || generarId(col, lista),
    fecha: reg.fecha || new Date().toISOString()
  };
  lista.push(nuevo);
  await escribir(col, lista);
  return nuevo;
}

// Actualiza un registro existente fusionando cambios
export async function actualizar(col, id, cambios) {
  const lista = await leer(col);
  const indice = lista.findIndex((item) => item.id === id);
  if (indice === -1) {
    throw Object.assign(new Error(`Registro no encontrado: ${id}`), { estado: 404 });
  }
  const actualizado = {
    ...lista[indice],
    ...cambios,
    id // El ID original no se altera
  };
  lista[indice] = actualizado;
  await escribir(col, lista);
  return actualizado;
}

// Elimina un registro por ID
export async function eliminar(col, id) {
  const lista = await leer(col);
  const indice = lista.findIndex((item) => item.id === id);
  if (indice === -1) {
    throw Object.assign(new Error(`Registro no encontrado: ${id}`), { estado: 404 });
  }
  const eliminado = lista.splice(indice, 1)[0];
  await escribir(col, lista);
  return eliminado;
}

// Busca registros según filtros exactos o función predicado
export async function buscar(col, filtro) {
  const lista = await leer(col);
  if (typeof filtro === 'function') {
    return lista.filter(filtro);
  }
  if (typeof filtro === 'object' && filtro !== null) {
    const pares = Object.entries(filtro);
    return lista.filter((item) => pares.every(([k, v]) => String(item[k]) === String(v)));
  }
  return lista;
}

// Anexa una línea JSON a un archivo .jsonl
export async function anexarLinea(archivo, obj) {
  const rutaCompleta = path.resolve(RUTA_DATOS, archivo.endsWith('.jsonl') ? archivo : `${archivo}.jsonl`);
  if (!rutaCompleta.startsWith(RUTA_DATOS)) {
    throw Object.assign(new Error('Acceso no permitido'), { estado: 403 });
  }
  return encolar(rutaCompleta, async () => {
    await asegurarRespaldoDiario();
    await fs.mkdir(path.dirname(rutaCompleta), { recursive: true });
    const linea = `${JSON.stringify(obj)}\n`;
    await fs.appendFile(rutaCompleta, linea, 'utf-8');
  });
}

// Lee todas las líneas de un archivo .jsonl como un arreglo de objetos
export async function leerLineas(archivo) {
  const rutaCompleta = path.resolve(RUTA_DATOS, archivo.endsWith('.jsonl') ? archivo : `${archivo}.jsonl`);
  try {
    const contenido = await fs.readFile(rutaCompleta, 'utf-8');
    return contenido
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => JSON.parse(l));
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

// Lee un archivo de configuración de datos/config/<nombre>.json
export async function leerConfig(nombre) {
  const archivo = nombre.endsWith('.json') ? nombre : `${nombre}.json`;
  const ruta = path.resolve(RUTA_DATOS, 'config', archivo);
  try {
    const contenido = await fs.readFile(ruta, 'utf-8');
    return JSON.parse(contenido);
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw error;
  }
}
