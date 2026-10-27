// publico/js/modulos/prueba-datos.js · Controlador de la página prueba de datos
import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';

await montarPlantilla({ titulo: 'Prueba de datos' });

const formulario = document.getElementById('formulario-prueba');
const campoTexto = document.getElementById('campo-texto');
const contenedorRegistros = document.getElementById('contenedor-registros');
const btnRecargar = document.getElementById('btn-recargar');

/**
 * Carga y muestra los registros actuales de la colección "prueba"
 */
async function cargarRegistros() {
  ui.cargando(true);
  try {
    const lista = await api.listar('prueba');
    renderizar(lista);
  } catch (error) {
    ui.aviso(`Error al cargar: ${error.message}`, 'error');
  } finally {
    ui.cargando(false);
  }
}

/**
 * Renderiza la lista de registros o un estado vacío
 * @param {Array} lista - Registros devueltos por la API
 */
function renderizar(lista) {
  if (!lista || lista.length === 0) {
    contenedorRegistros.innerHTML = `
      <div class="vacio" style="margin-top: var(--espacio-m);">
        <h3>Colección vacía</h3>
        <p>Aún no hay registros en la colección "prueba". Ingresa un texto arriba para comenzar.</p>
      </div>
    `;
    return;
  }

  const itemsHtml = lista.map((item) => `
    <div class="item-registro">
      <div class="pila" style="gap: var(--espacio-xs);">
        <strong>${ui.escapar(item.texto || '(Sin texto)')}</strong>
        <small>${item.fecha ? new Date(item.fecha).toLocaleString('es-EC') : ''}</small>
      </div>
      <span class="insignia insignia--suave">${ui.escapar(item.id)}</span>
    </div>
  `).join('');

  contenedorRegistros.innerHTML = `
    <div class="pila" style="gap: 0; border: 1px solid var(--color-borde); border-radius: var(--radio-m); overflow: hidden; background: var(--color-superficie); margin-top: var(--espacio-m);">
      ${itemsHtml}
    </div>
  `;
}

// Envío del formulario para crear un nuevo registro
formulario?.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const texto = campoTexto.value.trim();
  if (!texto) {
    ui.aviso('Por favor ingresa un texto.', 'advertencia');
    return;
  }

  ui.cargando(true);
  try {
    await api.crear('prueba', { texto });
    ui.aviso('Registro guardado con éxito en la colección "prueba"', 'exito');
    campoTexto.value = '';
    await cargarRegistros();
  } catch (error) {
    ui.aviso(`Error al guardar: ${error.message}`, 'error');
  } finally {
    ui.cargando(false);
  }
});

btnRecargar?.addEventListener('click', cargarRegistros);

// Carga inicial
await cargarRegistros();
