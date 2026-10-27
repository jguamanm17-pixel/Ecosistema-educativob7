// publico/js/nucleo/selector-tema.js · Obtención y selección de tema para actividades
import * as api from './api.js';
import * as ui from './ui.js';
import * as util from './util.js';

/**
 * Obtiene el tema para la actividad actual utilizando el parámetro ?temaId= o mostrando un selector accesible
 * @returns {Promise<Object>} Objeto del tema seleccionado
 */
export async function obtenerTemaActividad() {
  const paramTemaId = util.parametro('temaId');

  if (paramTemaId) {
    try {
      const tema = await api.obtener('temas', paramTemaId);
      if (tema && tema.id) {
        return tema;
      }
    } catch (err) {
      console.warn('No se pudo cargar el tema indicado en la URL:', err.message);
    }
  }

  // Si no hay tema en URL o falló, consultar temas disponibles
  ui.cargando(true);
  let temas = [];
  let unidades = [];
  let asignaturas = [];

  try {
    [temas, unidades, asignaturas] = await Promise.all([
      api.listar('temas'),
      api.listar('unidades'),
      api.listar('asignaturas')
    ]);
  } catch (err) {
    ui.cargando(false);
    throw new Error(`Error al cargar temas: ${err.message}`);
  } finally {
    ui.cargando(false);
  }

  if (!Array.isArray(temas) || temas.length === 0) {
    throw new Error('No tienes temas disponibles en tus asignaturas actuales');
  }

  // Si solo hay un tema disponible, seleccionarlo automáticamente
  if (temas.length === 1) {
    return temas[0];
  }

  const mapaAsignaturas = new Map(asignaturas.map((a) => [a.id, a.nombre]));
  const mapaUnidades = new Map(unidades.map((u) => [u.id, u]));

  // Construir diálogo modal para que el usuario elija
  return new Promise((resolve, reject) => {
    const contenedor = document.createElement('div');
    contenedor.className = 'pila';
    contenedor.style.gap = 'var(--espacio-m)';

    const texto = document.createElement('p');
    texto.textContent = 'Selecciona el tema sobre el cual deseas realizar esta actividad:';
    contenedor.appendChild(texto);

    const select = document.createElement('select');
    select.className = 'campo__control';
    select.style.width = '100%';

    temas.forEach((t) => {
      const u = mapaUnidades.get(t.unidadId);
      const asgNombre = u ? mapaAsignaturas.get(u.asignaturaId) : '';
      const prefijo = asgNombre ? `[${asgNombre}] ` : '';

      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = `${prefijo}${t.titulo}`;
      select.appendChild(opt);
    });

    contenedor.appendChild(select);

    ui.modal({
      titulo: 'Seleccionar tema de estudio',
      contenido: contenedor,
      acciones: [
        { texto: 'Cancelar', valor: null, clase: 'btn-secundario' },
        { texto: 'Continuar', valor: true, clase: 'btn-primario' }
      ]
    }).then((aceptado) => {
      if (!aceptado) {
        reject(new Error('Selección de tema cancelada'));
        return;
      }
      const temaSeleccionado = temas.find((t) => t.id === select.value) || temas[0];
      resolve(temaSeleccionado);
    });
  });
}

export default {
  obtenerTemaActividad
};
