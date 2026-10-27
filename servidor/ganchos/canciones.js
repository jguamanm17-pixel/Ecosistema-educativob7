// servidor/ganchos/canciones.js · Ganchos para la colección canciones
import * as almacen from '../almacen.js';
import { asignaturasDe, asignaturaDeTema, puedeEditarAsignatura } from '../acceso.js';

/**
 * Filtra las canciones según las asignaturas del usuario (a través del tema)
 * @param {Array} lista - Lista de canciones
 * @param {Object|null} usuario - Usuario en sesión
 * @returns {Promise<Array>}
 */
export async function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista) || !usuario) return [];
  if (usuario.rol === 'admin') return lista;

  const misAsignaturas = await asignaturasDe(usuario);
  const misAsigIds = new Set(misAsignaturas.map((a) => a.id));

  const temas = await almacen.leer('temas');
  const unidades = await almacen.leer('unidades');

  const mapaUnidadAsignatura = new Map(unidades.map((u) => [u.id, u.asignaturaId]));
  const mapaTemaAsignatura = new Map(
    temas.map((t) => [t.id, mapaUnidadAsignatura.get(t.unidadId)])
  );

  return lista.filter((cancion) => {
    const asgId = mapaTemaAsignatura.get(cancion.temaId);
    return asgId && misAsigIds.has(asgId);
  });
}

/**
 * Valida campos obligatorios y permisos sobre la asignatura antes de guardar una canción
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
    throw Object.assign(new Error('No tienes permisos para crear o editar canciones'), { estado: 403 });
  }

  const temaId = datos.temaId || (anterior && anterior.temaId);
  if (!temaId) {
    throw Object.assign(new Error('El tema académico asociado es obligatorio'), { estado: 400 });
  }

  // Verifica pertenencia y permisos de edición sobre la asignatura del tema
  const asignaturaId = await asignaturaDeTema(temaId);
  if (!asignaturaId) {
    throw Object.assign(new Error('No se pudo determinar la asignatura asociada al tema'), { estado: 400 });
  }

  const permitido = await puedeEditarAsignatura(usuario, asignaturaId);
  if (!permitido) {
    throw Object.assign(
      new Error('No tienes permisos de edición sobre la asignatura a la que pertenece este tema'),
      { estado: 403 }
    );
  }

  // Validaciones de campos obligatorios
  if (!datos.titulo || typeof datos.titulo !== 'string' || !datos.titulo.trim()) {
    throw Object.assign(new Error('El título de la canción es obligatorio'), { estado: 400 });
  }

  if (!datos.audio || typeof datos.audio !== 'string' || !datos.audio.trim()) {
    throw Object.assign(new Error('El archivo de audio MP3 es obligatorio'), { estado: 400 });
  }

  if (!datos.letra || typeof datos.letra !== 'string' || !datos.letra.trim()) {
    throw Object.assign(new Error('La letra de la canción es obligatoria'), { estado: 400 });
  }

  if (!datos.autoria || typeof datos.autoria !== 'string' || !datos.autoria.trim()) {
    throw Object.assign(new Error('La autoría de la canción es obligatoria'), { estado: 400 });
  }

  if (!datos.licencia || typeof datos.licencia !== 'string' || !datos.licencia.trim()) {
    throw Object.assign(new Error('La licencia de la canción es obligatoria'), { estado: 400 });
  }

  // Limpieza y normalización de datos
  datos.titulo = datos.titulo.trim();
  datos.temaId = temaId;
  datos.audio = datos.audio.trim();
  datos.letra = datos.letra.trim();
  datos.lrc = (datos.lrc && typeof datos.lrc === 'string' && datos.lrc.trim()) ? datos.lrc.trim() : null;
  datos.autoria = datos.autoria.trim();
  datos.licencia = datos.licencia.trim();

  return datos;
}

export default {
  filtrarLista,
  antesDeGuardar
};
