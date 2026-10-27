// servidor/auth.js · Autenticación, sesión activa y verificación de roles
import * as almacen from './almacen.js';

/**
 * Limpia las sesiones expiradas en el archivo datos/sesiones.json
 */
export async function limpiarSesionesVencidas() {
  try {
    const sesiones = await almacen.leer('sesiones');
    const ahora = new Date();
    const activas = sesiones.filter((s) => new Date(s.expira) > ahora);
    if (activas.length !== sesiones.length) {
      await almacen.escribir('sesiones', activas);
    }
  } catch (error) {
    console.error('Error al limpiar sesiones vencidas:', error.message);
  }
}

// Limpiar sesiones al cargarse el módulo
await limpiarSesionesVencidas();

/**
 * Middleware que lee "Authorization: Bearer <token>", valida vencimiento y asigna req.usuario
 */
export async function cargarUsuario(req, res, next) {
  req.usuario = null;
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return next();
  }

  try {
    const sesiones = await almacen.leer('sesiones');
    const ahora = new Date();
    const sesion = sesiones.find((s) => s.token === token && new Date(s.expira) > ahora);

    if (!sesion) {
      return next();
    }

    const usuarios = await almacen.leer('usuarios');
    const usuario = usuarios.find((u) => u.id === sesion.usuarioId && u.activo === true);

    if (usuario) {
      req.usuario = {
        id: usuario.id,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        rol: usuario.rol
      };
    }
  } catch (error) {
    console.error('Error en cargarUsuario:', error.message);
  }

  next();
}

/**
 * Middleware que exige sesión activa y restringe según los roles permitidos
 * @param {...string} roles - Roles requeridos ('estudiante', 'docente', 'admin')
 */
export function exigirRol(...roles) {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({ error: 'Sesión no iniciada o token inválido' });
    }

    if (roles.length > 0 && !roles.includes(req.usuario.rol)) {
      return res.status(403).json({ error: 'Acceso no autorizado para tu rol' });
    }

    next();
  };
}
