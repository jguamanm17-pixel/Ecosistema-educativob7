// servidor/crear-admin.js · Script interactivo por consola para crear un usuario administrador
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import bcrypt from 'bcryptjs';
import * as almacen from './almacen.js';

function esCorreoValido(correo) {
  if (typeof correo !== 'string') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.trim());
}

function esClaveValida(clave) {
  if (typeof clave !== 'string' || clave.length < 8) return false;
  return /[a-zA-Z]/.test(clave) && /\d/.test(clave);
}

async function ejecutar() {
  const rl = readline.createInterface({ input, output });

  try {
    console.log('=== Crear Usuario Administrador ===\n');

    const nombre = (await rl.question('Nombre: ')).trim();
    const apellido = (await rl.question('Apellido: ')).trim();
    const correo = (await rl.question('Correo: ')).trim().toLowerCase();
    const clave = (await rl.question('Clave: ')).trim();

    if (!nombre || !apellido) {
      console.error('\nError: El nombre y apellido son obligatorios.');
      process.exit(1);
    }

    if (!esCorreoValido(correo)) {
      console.error('\nError: El correo electrónico no tiene un formato válido.');
      process.exit(1);
    }

    if (!esClaveValida(clave)) {
      console.error('\nError: La clave debe tener al menos 8 caracteres y combinar letras y números.');
      process.exit(1);
    }

    const usuarios = await almacen.leer('usuarios');
    if (usuarios.some((u) => u.correo.toLowerCase() === correo)) {
      console.error('\nError: Ya existe un usuario registrado con ese correo electrónico.');
      process.exit(1);
    }

    const claveHash = await bcrypt.hash(clave, 10);
    const nuevoAdmin = {
      nombre,
      apellido,
      correo,
      claveHash,
      rol: 'admin',
      activo: true,
      foto: null,
      consentimiento: {
        aceptado: true,
        fecha: new Date().toISOString()
      }
    };

    const creado = await almacen.agregar('usuarios', nuevoAdmin);

    // Registro del evento en bitácora
    await almacen.anexarLinea('bitacora.jsonl', {
      usuarioId: creado.id,
      tipo: 'crear-admin',
      recurso: 'sistema',
      fecha: new Date().toISOString()
    });

    console.log(`\n✔ Administrador creado exitosamente.`);
    console.log(`ID:     ${creado.id}`);
    console.log(`Nombre: ${creado.nombre} ${creado.apellido}`);
    console.log(`Correo: ${creado.correo}`);
    console.log(`Rol:    ${creado.rol}`);
  } catch (error) {
    console.error('\nError al crear administrador:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

ejecutar();
