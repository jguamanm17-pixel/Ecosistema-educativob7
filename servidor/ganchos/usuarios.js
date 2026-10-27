// servidor/ganchos/usuarios.js · Ganchos del ciclo de vida para la colección usuarios

/**
 * Filtra la lista de usuarios omitiendo el hash de contraseña
 * @param {Array} lista - Lista de usuarios
 * @param {Object|null} usuario - Usuario actual en sesión
 * @returns {Promise<Array>}
 */
export async function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista)) return [];
  return lista.map(({ claveHash, ...resto }) => resto);
}

/**
 * Validaciones y filtros antes de guardar un usuario
 * @param {Object} datos - Cambios o datos a guardar
 * @param {Object|null} usuario - Usuario en sesión
 * @param {Object|null} anterior - Registro previo en caso de actualización
 * @returns {Promise<Object>}
 */
export async function antesDeGuardar(datos, usuario, anterior) {
  // Ignora claveHash desde la API genérica
  delete datos.claveHash;

  if (anterior) {
    // Ignora correo en actualizaciones
    delete datos.correo;

    // Evita que un admin se quite el rol o se desactive a sí mismo
    if (usuario && anterior.id === usuario.id) {
      if (datos.rol !== undefined && datos.rol !== anterior.rol) {
        throw Object.assign(new Error('No puedes cambiar tu propio rol de administrador'), { estado: 403 });
      }
      if (datos.activo !== undefined && datos.activo === false && anterior.activo === true) {
        throw Object.assign(new Error('No puedes desactivar tu propia cuenta'), { estado: 403 });
      }
    }
  }

  return datos;
}

export default {
  filtrarLista,
  antesDeGuardar
};
