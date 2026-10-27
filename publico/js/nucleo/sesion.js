// publico/js/nucleo/sesion.js · Gestión de sesiones de usuario en el navegador
import * as api from './api.js';

/**
 * Obtiene el token de autenticación guardado en la sesión
 * @returns {string|null} Token activo o null
 */
export function token() {
  if (typeof sessionStorage === 'undefined') return null;
  return sessionStorage.getItem('token');
}

/**
 * Obtiene los datos del usuario activo guardados en la sesión
 * @returns {Object|null} Objeto { id, nombre, apellido, rol } o null
 */
export function usuarioActual() {
  if (typeof sessionStorage === 'undefined') return null;
  const raw = sessionStorage.getItem('usuario');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Registra un nuevo estudiante en el servidor
 * @param {Object} datos - { nombre, apellido, correo, clave, consentimiento }
 * @returns {Promise<Object>}
 */
export async function registrar(datos) {
  return api.llamar('POST', '/api/auth/registro', datos);
}

/**
 * Inicia sesión con correo y contraseña, guardando token y usuario en sessionStorage
 * @param {string} correo - Correo institucional
 * @param {string} clave - Contraseña
 * @returns {Promise<Object>} { token, usuario }
 */
export async function iniciar(correo, clave) {
  const resultado = await api.llamar('POST', '/api/auth/login', { correo, clave });
  if (resultado && resultado.token && resultado.usuario) {
    sessionStorage.setItem('token', resultado.token);
    sessionStorage.setItem('usuario', JSON.stringify(resultado.usuario));
  }
  return resultado;
}

/**
 * Cierra la sesión activa en el servidor y limpia el almacenamiento local
 */
export async function cerrar() {
  try {
    await api.llamar('POST', '/api/auth/logout');
  } catch (error) {
    console.debug('Aviso al cerrar sesión en servidor:', error.message);
  } finally {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('usuario');
    }
    if (typeof window !== 'undefined') {
      window.location.href = '/paginas/ingreso.html';
    }
  }
}

/**
 * Valida si el usuario actual cumple con los roles requeridos para una vista
 * Sin sesión redirige a /paginas/ingreso.html
 * Con rol no permitido redirige a /index.html con un aviso
 * @param {string[]} [roles=[]] - Roles permitidos ('publico', 'sesion', 'estudiante', 'docente', 'admin')
 */
export function exigirRol(roles = []) {
  if (!roles || roles.length === 0 || roles.includes('publico')) {
    return;
  }

  const usuario = usuarioActual();

  // Sin sesión → redirigir a ingreso.html
  if (!usuario) {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(
        'aviso_pendiente',
        JSON.stringify({ texto: 'Debes iniciar sesión para acceder a esta página.', tipo: 'info' })
      );
    }
    if (typeof window !== 'undefined') {
      window.location.href = '/paginas/ingreso.html';
    }
    throw new Error('Sesión requerida');
  }

  // Requiere cualquier sesión iniciada
  if (roles.includes('sesion')) {
    return;
  }

  // Verifica roles específicos
  if (!roles.includes(usuario.rol)) {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(
        'aviso_pendiente',
        JSON.stringify({ texto: 'Acceso no autorizado: tu rol no tiene permisos para esta sección.', tipo: 'error' })
      );
    }
    if (typeof window !== 'undefined') {
      window.location.href = '/index.html';
    }
    throw new Error('Rol no autorizado');
  }
}
