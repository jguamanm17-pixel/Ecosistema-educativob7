// publico/js/modulos/admin-asignaturas.js · Gestión de asignaturas (admin)
import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import { aviso, confirmar, modal, cargando, escapar } from '../nucleo/ui.js';

await montarPlantilla({ titulo: 'Asignaturas', roles: ['admin'] });

const btnNuevaAsignatura = document.getElementById('btn-nueva-asignatura');
const cuadriculaAsignaturas = document.getElementById('cuadricula-asignaturas');

let listaAsignaturas = [];
let listaDistributivo = [];

// Cargar asignaturas y distributivo desde la API
async function cargarDatos() {
  cargando(true);
  try {
    const [asignaturas, distributivo] = await Promise.all([
      api.listar('asignaturas'),
      api.listar('distributivo')
    ]);
    listaAsignaturas = asignaturas;
    listaDistributivo = distributivo;
    renderizarAsignaturas();
  } catch (error) {
    aviso(error.message || 'Error al cargar asignaturas', 'error');
    cuadriculaAsignaturas.innerHTML = `
      <div class="tarjeta" style="grid-column: 1 / -1; text-align: center; color: var(--color-error); padding: var(--espacio-l);">
        ${escapar(error.message || 'Error al conectar con el servidor')}
      </div>
    `;
  } finally {
    cargando(false);
  }
}

// Renderizar tarjetas de asignaturas
function renderizarAsignaturas() {
  if (listaAsignaturas.length === 0) {
    cuadriculaAsignaturas.innerHTML = `
      <div class="tarjeta" style="grid-column: 1 / -1; text-align: center; padding: var(--espacio-xl); color: var(--color-texto-suave);">
        <p style="font-size: var(--tamano-lg); margin-bottom: var(--espacio-s);">No hay asignaturas registradas.</p>
        <p style="font-size: var(--tamano-sm);">Haz clic en "+ Nueva asignatura" para crear la primera.</p>
      </div>
    `;
    return;
  }

  cuadriculaAsignaturas.innerHTML = '';

  for (const asg of listaAsignaturas) {
    const gruposAsociados = listaDistributivo.filter((d) => d.asignaturaId === asg.id);
    const numGrupos = gruposAsociados.length;

    const tarjeta = document.createElement('article');
    tarjeta.className = 'asignatura-tarjeta';
    tarjeta.innerHTML = `
      <div>
        <div class="asignatura-tarjeta__cabecera">
          <span class="asignatura-tarjeta__nivel">${escapar(asg.nivel || 'Educación Superior')}</span>
          <h2 class="asignatura-tarjeta__titulo">${escapar(asg.nombre)}</h2>
        </div>
        <div class="asignatura-tarjeta__cuerpo">
          <p class="asignatura-tarjeta__descripcion">${escapar(asg.descripcion || 'Sin descripción disponible.')}</p>
          <div class="asignatura-tarjeta__meta">
            <span aria-hidden="true">👥</span>
            <span>${numGrupos} ${numGrupos === 1 ? 'grupo registrado' : 'grupos registrados'}</span>
          </div>
        </div>
      </div>
      <div class="asignatura-tarjeta__pie">
        <button type="button" class="btn btn--secundario btn--pequeno btn-editar" aria-label="Editar ${escapar(asg.nombre)}">
          Editar
        </button>
        <button type="button" class="btn btn--peligro btn--pequeno btn-eliminar" aria-label="Eliminar ${escapar(asg.nombre)}">
          Eliminar
        </button>
      </div>
    `;

    // Evento Editar
    tarjeta.querySelector('.btn-editar').addEventListener('click', () => {
      abrirModalAsignatura(asg);
    });

    // Evento Eliminar
    tarjeta.querySelector('.btn-eliminar').addEventListener('click', async () => {
      if (numGrupos > 0) {
        aviso(
          `No se puede eliminar la asignatura "${asg.nombre}" porque tiene ${numGrupos} grupo(s) asociado(s) en el distributivo.`,
          'advertencia'
        );
        return;
      }

      const confirmado = await confirmar(
        `¿Estás seguro de que deseas eliminar permanentemente la asignatura "${asg.nombre}"?`
      );
      if (!confirmado) return;

      cargando(true);
      try {
        await api.eliminar('asignaturas', asg.id);
        aviso('Asignatura eliminada con éxito', 'exito');
        await cargarDatos();
      } catch (error) {
        aviso(error.message || 'Error al eliminar la asignatura', 'error');
      } finally {
        cargando(false);
      }
    });

    cuadriculaAsignaturas.appendChild(tarjeta);
  }
}

// Modal para crear o editar asignatura
async function abrirModalAsignatura(asignatura = null) {
  const esEdicion = Boolean(asignatura);

  const contenedor = document.createElement('div');
  contenedor.className = 'pila';
  contenedor.style.gap = 'var(--espacio-m)';
  contenedor.innerHTML = `
    <div class="campo">
      <label for="asg-nombre">Nombre de la asignatura</label>
      <input type="text" id="asg-nombre" placeholder="Ej. Seguridad en la Construcción" value="${escapar(asignatura?.nombre || '')}" required>
      <span class="campo__error" id="error-asg-nombre"></span>
    </div>
    <div class="campo">
      <label for="asg-nivel">Nivel académico / Audiencia</label>
      <input type="text" id="asg-nivel" placeholder="Ej. Estudiantes de Ingeniería Civil" value="${escapar(asignatura?.nivel || '')}" required>
      <span class="campo__error" id="error-asg-nivel"></span>
    </div>
    <div class="campo">
      <label for="asg-descripcion">Descripción general</label>
      <textarea id="asg-descripcion" rows="3" placeholder="Describe los contenidos y alcance de la asignatura..." required>${escapar(asignatura?.descripcion || '')}</textarea>
      <span class="campo__error" id="error-asg-descripcion"></span>
    </div>
  `;

  const inputNombre = contenedor.querySelector('#asg-nombre');
  const inputNivel = contenedor.querySelector('#asg-nivel');
  const inputDescripcion = contenedor.querySelector('#asg-descripcion');
  const errorNombre = contenedor.querySelector('#error-asg-nombre');
  const errorNivel = contenedor.querySelector('#error-asg-nivel');
  const errorDescripcion = contenedor.querySelector('#error-asg-descripcion');

  const resultado = await modal({
    titulo: esEdicion ? 'Editar Asignatura' : 'Nueva Asignatura',
    contenido: contenedor,
    acciones: [
      { texto: 'Cancelar', valor: null, clase: 'btn--secundario' },
      { texto: esEdicion ? 'Actualizar' : 'Crear', valor: 'guardar', clase: 'btn--primario' }
    ]
  });

  if (resultado === 'guardar') {
    const nombre = inputNombre.value.trim();
    const nivel = inputNivel.value.trim();
    const descripcion = inputDescripcion.value.trim();

    let tieneError = false;
    if (!nombre) {
      errorNombre.textContent = 'El nombre es obligatorio';
      tieneError = true;
    }
    if (!nivel) {
      errorNivel.textContent = 'El nivel es obligatorio';
      tieneError = true;
    }
    if (!descripcion) {
      errorDescripcion.textContent = 'La descripción es obligatoria';
      tieneError = true;
    }

    if (tieneError) {
      aviso('Por favor completa todos los campos requeridos', 'advertencia');
      return;
    }

    cargando(true);
    try {
      const payload = { nombre, nivel, descripcion };
      if (esEdicion) {
        await api.actualizar('asignaturas', asignatura.id, payload);
        aviso('Asignatura actualizada con éxito', 'exito');
      } else {
        await api.crear('asignaturas', payload);
        aviso('Asignatura creada con éxito', 'exito');
      }
      await cargarDatos();
    } catch (error) {
      aviso(error.message || 'Error al guardar la asignatura', 'error');
    } finally {
      cargando(false);
    }
  }
}

btnNuevaAsignatura.addEventListener('click', () => abrirModalAsignatura());

await cargarDatos();
