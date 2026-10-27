// servidor/ganchos/lecturas-noticias.js · Ganchos para la colección lecturas-noticias
import * as almacen from '../almacen.js';

/**
 * Filtra las lecturas de noticias para devolver únicamente las del propio usuario
 * @param {Array} lista - Lista de lecturas
 * @param {Object|null} usuario - Usuario en sesión
 * @returns {Promise<Array>}
 */
export async function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista) || !usuario) return [];
  return lista.filter((l) => l.usuarioId === usuario.id);
}

/**
 * Fija usuarioId al usuario en sesión y evita lecturas duplicadas para la misma noticia
 * @param {Object} datos - Datos a guardar
 * @param {Object|null} usuario - Usuario en sesión
 * @param {Object|null} anterior - Registro anterior si es actualización
 * @returns {Promise<Object>}
 */
export async function antesDeGuardar(datos, usuario, anterior) {
  if (!usuario) {
    throw Object.assign(new Error('Acceso no autorizado'), { estado: 401 });
  }

  if (!datos.noticiaId) {
    throw Object.assign(new Error('El campo noticiaId es obligatorio'), { estado: 400 });
  }

  // Fija usuarioId al usuario en sesión
  datos.usuarioId = usuario.id;

  // Evita lecturas duplicadas para la misma noticia por el mismo usuario
  const existentes = await almacen.leer('lecturas-noticias');
  const esDuplicado = existentes.some(
    (l) =>
      l.usuarioId === usuario.id &&
      l.noticiaId === datos.noticiaId &&
      (!anterior || l.id !== anterior.id)
  );

  if (esDuplicado) {
    throw Object.assign(
      new Error('Esta noticia ya fue registrada como leída por el usuario'),
      { estado: 400 }
    );
  }

  return datos;
}

export default {
  filtrarLista,
  antesDeGuardar
};
