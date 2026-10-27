// servidor/rutas/auth.js · Rutas de autenticación, administración y bitácora
import { Router } from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import * as almacen from '../almacen.js';
import { exigirRol } from '../auth.js';

const router = Router();

// Control de intentos fallidos en memoria (correo -> [timestamps])
const intentosLogin = new Map();

function registrarFalloLogin(correo) {
  const ahora = Date.now();
  const fallos = (intentosLogin.get(correo) || []).filter((t) => ahora - t < 15 * 60 * 1000);
  fallos.push(ahora);
  intentosLogin.set(correo, fallos);
}

function verificarBloqueoLogin(correo) {
  const ahora = Date.now();
  const ventana = 15 * 60 * 1000;
  const fallos = (intentosLogin.get(correo) || []).filter((t) => ahora - t < ventana);
  intentosLogin.set(correo, fallos);
  return fallos.length >= 5;
}

function esCorreoValido(correo) {
  if (typeof correo !== 'string') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.trim());
}

function esClaveValida(clave) {
  if (typeof clave !== 'string' || clave.length < 8) return false;
  const tieneLetra = /[a-zA-Z]/.test(clave);
  const tieneNumero = /\d/.test(clave);
  return tieneLetra && tieneNumero;
}

const asincrono = (controlador) => (req, res, next) => {
  Promise.resolve(controlador(req, res, next)).catch(next);
};

// POST /api/auth/registro
router.post(
  '/auth/registro',
  asincrono(async (req, res) => {
    const { nombre, apellido, correo, clave, consentimiento } = req.body;

    if (!nombre || !apellido || typeof nombre !== 'string' || typeof apellido !== 'string' || !nombre.trim() || !apellido.trim()) {
      return res.status(400).json({ error: 'Nombre y apellido son obligatorios' });
    }

    if (!esCorreoValido(correo)) {
      return res.status(400).json({ error: 'Correo electrónico inválido' });
    }

    if (!esClaveValida(clave)) {
      return res.status(400).json({ error: 'La contraseña debe tener 8 o más caracteres y contener letras y números' });
    }

    if (consentimiento !== true) {
      return res.status(400).json({ error: 'Debe aceptar el consentimiento para registrarse' });
    }

    const correoLimpio = correo.trim().toLowerCase();
    const usuarios = await almacen.leer('usuarios');

    if (usuarios.some((u) => u.correo.toLowerCase() === correoLimpio)) {
      return res.status(400).json({ error: 'El correo electrónico ya está registrado' });
    }

    const claveHash = await bcrypt.hash(clave, 10);
    const nuevoUsuario = {
      nombre: nombre.trim(),
      apellido: apellido.trim(),
      correo: correoLimpio,
      claveHash,
      rol: 'estudiante',
      activo: true,
      foto: null,
      consentimiento: {
        aceptado: true,
        fecha: new Date().toISOString()
      }
    };

    const creado = await almacen.agregar('usuarios', nuevoUsuario);
    res.status(201).json({
      id: creado.id,
      nombre: creado.nombre,
      apellido: creado.apellido,
      correo: creado.correo,
      rol: creado.rol
    });
  })
);

// POST /api/auth/login
router.post(
  '/auth/login',
  asincrono(async (req, res) => {
    const { correo, clave } = req.body;
    const correoLimpio = (correo || '').trim().toLowerCase();

    if (verificarBloqueoLogin(correoLimpio)) {
      return res.status(429).json({ error: 'Demasiados intentos fallidos. Intente de nuevo en 15 minutos.' });
    }

    if (!correoLimpio || !clave) {
      registrarFalloLogin(correoLimpio);
      return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
    }

    const usuarios = await almacen.leer('usuarios');
    const usuario = usuarios.find((u) => u.correo.toLowerCase() === correoLimpio);

    if (!usuario || !usuario.activo) {
      registrarFalloLogin(correoLimpio);
      return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
    }

    const coincide = await bcrypt.compare(clave, usuario.claveHash);
    if (!coincide) {
      registrarFalloLogin(correoLimpio);
      return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
    }

    // Éxito: limpiar fallos en memoria
    intentosLogin.delete(correoLimpio);

    const token = crypto.randomBytes(32).toString('hex');
    const expira = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(); // 8 horas

    await almacen.agregar('sesiones', { token, usuarioId: usuario.id, expira });
    await almacen.anexarLinea('bitacora.jsonl', {
      usuarioId: usuario.id,
      tipo: 'login',
      recurso: 'auth',
      fecha: new Date().toISOString()
    });

    res.json({
      token,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        rol: usuario.rol,
        foto: usuario.foto || null
      }
    });
  })
);

// POST /api/auth/logout
router.post(
  '/auth/logout',
  exigirRol(),
  asincrono(async (req, res) => {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.slice(7).trim();

    if (token) {
      const sesiones = await almacen.leer('sesiones');
      const restantes = sesiones.filter((s) => s.token !== token);
      await almacen.escribir('sesiones', restantes);
    }

    await almacen.anexarLinea('bitacora.jsonl', {
      usuarioId: req.usuario.id,
      tipo: 'logout',
      recurso: 'auth',
      fecha: new Date().toISOString()
    });

    res.json({ ok: true });
  })
);

// GET /api/auth/yo
router.get(
  '/auth/yo',
  exigirRol(),
  asincrono(async (req, res) => {
    const usuarios = await almacen.leer('usuarios');
    const usuario = usuarios.find((u) => u.id === req.usuario.id);

    if (!usuario || !usuario.activo) {
      return res.status(404).json({ error: 'Usuario no encontrado o inactivo' });
    }

    const { claveHash, ...perfil } = usuario;
    res.json(perfil);
  })
);

// PUT /api/auth/perfil
router.put(
  '/auth/perfil',
  exigirRol(),
  asincrono(async (req, res) => {
    const { nombre, apellido, foto } = req.body;
    const cambios = {};

    if (typeof nombre === 'string' && nombre.trim()) cambios.nombre = nombre.trim();
    if (typeof apellido === 'string' && apellido.trim()) cambios.apellido = apellido.trim();
    if (foto !== undefined) cambios.foto = foto;

    const actualizado = await almacen.actualizar('usuarios', req.usuario.id, cambios);
    const { claveHash, ...perfil } = actualizado;
    res.json(perfil);
  })
);

// POST /api/auth/clave
router.post(
  '/auth/clave',
  exigirRol(),
  asincrono(async (req, res) => {
    const { actual, nueva } = req.body;

    if (!actual || !nueva) {
      return res.status(400).json({ error: 'Debe ingresar la contraseña actual y la nueva' });
    }

    const usuarios = await almacen.leer('usuarios');
    const usuario = usuarios.find((u) => u.id === req.usuario.id);

    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const coincide = await bcrypt.compare(actual, usuario.claveHash);
    if (!coincide) {
      return res.status(400).json({ error: 'La contraseña actual es incorrecta' });
    }

    if (!esClaveValida(nueva)) {
      return res.status(400).json({ error: 'La nueva contraseña debe tener 8 o más caracteres y contener letras y números' });
    }

    const claveHash = await bcrypt.hash(nueva, 10);
    await almacen.actualizar('usuarios', req.usuario.id, { claveHash });
    res.json({ ok: true });
  })
);

// POST /api/admin/usuarios/:id/restablecer (solo admin)
router.post(
  '/admin/usuarios/:id/restablecer',
  exigirRol('admin'),
  asincrono(async (req, res) => {
    const { id } = req.params;
    const usuarios = await almacen.leer('usuarios');
    const usuario = usuarios.find((u) => u.id === id);

    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Generar clave temporal de 10 caracteres con letras y números
    const caracteres = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
    let claveTemporal = '';
    for (let i = 0; i < 10; i++) {
      claveTemporal += caracteres[crypto.randomInt(0, caracteres.length)];
    }
    if (!/[a-zA-Z]/.test(claveTemporal) || !/\d/.test(claveTemporal)) {
      claveTemporal = 'A1' + claveTemporal.slice(2);
    }

    const claveHash = await bcrypt.hash(claveTemporal, 10);
    await almacen.actualizar('usuarios', id, { claveHash });

    res.json({ claveTemporal });
  })
);

// POST /api/eventos (registro de bitácora)
router.post(
  '/eventos',
  asincrono(async (req, res) => {
    const { tipo, recurso } = req.body;

    if (!tipo || !recurso) {
      return res.status(400).json({ error: 'Los campos tipo y recurso son obligatorios' });
    }

    await almacen.anexarLinea('bitacora.jsonl', {
      usuarioId: req.usuario ? req.usuario.id : null,
      tipo: String(tipo),
      recurso: String(recurso),
      fecha: new Date().toISOString()
    });

    res.status(201).json({ ok: true });
  })
);

export default router;
