// servidor/permisos.js · Control de acceso por colección y rol
import { leerConfig } from './almacen.js';

/**
 * Evalúa si un usuario puede realizar una acción ("leer" o "escribir") sobre una colección
 * @param {Object|null} usuario - Usuario autenticado o null
 * @param {'leer'|'escribir'} accion - Acción solicitada
 * @param {string} col - Nombre de la colección
 * @param {Object|null} [registro=null] - Registro específico a evaluar
 * @returns {Promise<boolean>}
 */
export async function puede(usuario, accion, col, registro = null) {
  const permisos = await leerConfig('permisos');
  const nombreBase = col.split('/')[0];
  const reglasCol = permisos[col] || permisos[nombreBase];

  if (!reglasCol) {
    return false;
  }

  const permitidos = reglasCol[accion];
  if (!Array.isArray(permitidos)) {
    return false;
  }

  for (const regla of permitidos) {
    // "servidor" nunca se permite desde la API
    if (regla === 'servidor') {
      continue;
    }

    if (regla === 'publico') {
      return true;
    }

    if (regla === 'sesion' && usuario) {
      return true;
    }

    if (usuario && usuario.rol && regla === usuario.rol) {
      return true;
    }

    // "propio" compara registro.usuarioId con usuario.id (o autoriza listar para posterior filtrado en ganchos)
    if (regla === 'propio' && usuario) {
      if (!registro) {
        return true;
      }
      if (registro.usuarioId && registro.usuarioId === usuario.id) {
        return true;
      }
      if (nombreBase === 'usuarios' && registro.id === usuario.id) {
        return true;
      }
    }
  }

  return false;
}
