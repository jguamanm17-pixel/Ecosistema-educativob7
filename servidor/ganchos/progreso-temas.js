// servidor/ganchos/progreso-temas.js · Ganchos para la colección progreso-temas
import * as almacen from '../almacen.js';
import { estudiantesDe } from '../acceso.js';

/**
 * Filtra el progreso de temas según rol (admin: todos; docente: sus estudiantes; estudiante: propio)
 * @param {Array} lista - Lista de progreso-temas
 * @param {Object|null} usuario - Usuario en sesión
 * @returns {Promise<Array>}
 */
export async function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista) || !usuario) return [];
  if (usuario.rol === 'admin') return lista;

  if (usuario.rol === 'estudiante') {
    return lista.filter((p) => p.usuarioId === usuario.id);
  }

  if (usuario.rol === 'docente') {
    const misEstudiantes = await estudiantesDe(usuario.id);
    const idsEstudiantes = new Set(misEstudiantes);
    return lista.filter((p) => idsEstudiantes.has(p.usuarioId));
  }

  return [];
}

/**
 * Fija usuarioId = usuario.id y rechaza registros duplicados para el mismo tema
 * @param {Object} datos - Datos a guardar
 * @param {Object|null} usuario - Usuario en sesión
 * @param {Object|null} anterior - Registro anterior si es actualización
 * @returns {Promise<Object>}
 */
export async function antesDeGuardar(datos, usuario, anterior) {
  if (!usuario) {
    throw Object.assign(new Error('Acceso no autorizado'), { estado: 401 });
  }

  if (!datos.temaId) {
    throw Object.assign(new Error('El campo temaId es obligatorio'), { estado: 400 });
  }

  // Fija usuarioId al usuario en sesión
  datos.usuarioId = usuario.id;

  // Rechazar duplicados (usuarioId + temaId)
  const existentes = await almacen.leer('progreso-temas');
  const esDuplicado = existentes.some(
    (p) =>
      p.usuarioId === usuario.id &&
      p.temaId === datos.temaId &&
      (!anterior || p.id !== anterior.id)
  );

  if (esDuplicado) {
    throw Object.assign(
      new Error('Ya existe un registro de progreso para este tema'),
      { estado: 400 }
    );
  }

  return datos;
}

export default {
  filtrarLista,
  antesDeGuardar
};
