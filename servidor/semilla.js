// servidor/semilla.js · Carga de datos de semilla en la plataforma
import fs from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import bcrypt from 'bcryptjs';
import * as almacen from './almacen.js';

const RUTA_SEMILLA = path.resolve('datos', 'semilla');
const RUTA_DATOS = path.resolve('datos');

async function sembrar() {
  const args = process.argv.slice(2);
  const forzar = args.includes('--forzar') || args.includes('-f');
  const confirmarSi = args.includes('--si') || args.includes('-y') || !stdin.isTTY;

  try {
    const archivos = await fs.readdir(RUTA_SEMILLA);
    const archivosJson = archivos.filter((a) => a.endsWith('.json')).sort();

    if (archivosJson.length === 0) {
      console.log('No se encontraron archivos JSON en datos/semilla/.');
      return;
    }

    if (forzar && !confirmarSi) {
      const rl = readline.createInterface({ input: stdin, output: stdout });
      const respuesta = await rl.question(
        'ADVERTENCIA: Se sobrescribirán las colecciones existentes con los datos semilla. ¿Deseas continuar? (s/N): '
      );
      rl.close();

      if (!/^s(i)?$/i.test(respuesta.trim())) {
        console.log('Operación de siembra cancelada por el usuario.');
        return;
      }
    }

    console.log('=== Iniciando siembra de datos ===');
    const claveHashDemo = await bcrypt.hash('Demo12345', 10);

    for (const archivo of archivosJson) {
      const col = path.basename(archivo, '.json');
      const rutaDestino = path.join(RUTA_DATOS, archivo);

      let existe = false;
      try {
        await fs.access(rutaDestino);
        existe = true;
      } catch {
        existe = false;
      }

      if (existe && !forzar) {
        console.log(`- [OMITIDO] ${archivo} ya existe en datos/. (Usa --forzar para sobrescribir)`);
        continue;
      }

      const contenido = await fs.readFile(path.join(RUTA_SEMILLA, archivo), 'utf8');
      const datos = JSON.parse(contenido);

      // Si es la colección de usuarios, generar claveHash con Demo12345 para todos
      if (col === 'usuarios' && Array.isArray(datos)) {
        for (const usuario of datos) {
          usuario.claveHash = claveHashDemo;
        }
      }

      await almacen.escribir(col, datos);
      console.log(`✔ [SEMBRADO] ${col} (${datos.length} registros guardados)`);
    }

    console.log('=== Siembra finalizada con éxito ===');
  } catch (error) {
    console.error('Error durante la siembra de datos:', error.message);
    process.exit(1);
  }
}

sembrar();
