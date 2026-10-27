// servidor/ganchos/noticias.js · Ganchos para la colección noticias
/**
 * Filtra las noticias visibles: los estudiantes solo ven las publicadas; docentes y admin ven todas
 * @param {Array} lista - Lista de noticias
 * @param {Object|null} usuario - Usuario en sesión
 * @returns {Promise<Array>}
 */
export async function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista) || !usuario) return [];
  if (usuario.rol === 'admin' || usuario.rol === 'docente') {
    return lista;
  }
  return lista.filter((n) => n.estado === 'publicado');
}

/**
 * Valida los datos de la noticia, fija autorId al crear y fechaPublicacion al pasar a "publicado"
 * @param {Object} datos - Datos a guardar
 * @param {Object|null} usuario - Usuario en sesión
 * @param {Object|null} anterior - Registro previo en actualización
 * @returns {Promise<Object>}
 */
export async function antesDeGuardar(datos, usuario, anterior) {
  if (!usuario) {
    throw Object.assign(new Error('Acceso no autorizado'), { estado: 401 });
  }

  if (usuario.rol !== 'docente' && usuario.rol !== 'admin') {
    throw Object.assign(new Error('No tienes permisos para crear o editar noticias'), { estado: 403 });
  }

  if (!datos.titulo || typeof datos.titulo !== 'string' || !datos.titulo.trim()) {
    throw Object.assign(new Error('El título de la noticia es obligatorio'), { estado: 400 });
  }

  if (datos.resumen && typeof datos.resumen === 'string' && datos.resumen.length > 200) {
    throw Object.assign(new Error('El resumen no puede exceder los 200 caracteres'), { estado: 400 });
  }

  // Fija autorId al crear o preserva el existente
  if (!anterior) {
    datos.autorId = usuario.id;
  } else {
    datos.autorId = anterior.autorId || usuario.id;
  }

  // Normalización de estado y defaults
  datos.titulo = datos.titulo.trim();
  datos.resumen = (datos.resumen || '').trim();
  datos.cuerpo = datos.cuerpo || '';
  datos.imagen = datos.imagen || null;
  datos.categoria = datos.categoria || 'Institucional';
  datos.temaId = datos.temaId || null;
  datos.destacada = Boolean(datos.destacada);
  datos.estado = datos.estado === 'publicado' ? 'publicado' : 'borrador';

  // Fija fechaPublicacion cuando el estado pasa a "publicado"
  if (datos.estado === 'publicado') {
    if (!anterior || anterior.estado !== 'publicado' || !anterior.fechaPublicacion) {
      datos.fechaPublicacion = datos.fechaPublicacion || new Date().toISOString();
    } else {
      datos.fechaPublicacion = anterior.fechaPublicacion;
    }
  } else {
    datos.fechaPublicacion = null;
  }

  return datos;
}

export default {
  filtrarLista,
  antesDeGuardar
};
