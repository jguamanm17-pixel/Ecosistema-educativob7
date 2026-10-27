// publico/js/modulos/distributivo.js · Gestión de distributivo académico (admin)
import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import { aviso, confirmar, modal, cargando, escapar } from '../nucleo/ui.js';
import { normalizar } from '../nucleo/util.js';

await montarPlantilla({ titulo: 'Distributivo', roles: ['admin'] });

const btnNuevoGrupo = document.getElementById('btn-nuevo-grupo');
const tbodyDistributivo = document.getElementById('tbody-distributivo');

let listaDistributivo = [];
let listaAsignaturas = [];
let listaUsuarios = [];

// Carga inicial de datos
async function cargarDatos() {
  cargando(true);
  try {
    const [distributivo, asignaturas, usuarios] = await Promise.all([
      api.listar('distributivo'),
      api.listar('asignaturas'),
      api.listar('usuarios')
    ]);
    listaDistributivo = distributivo;
    listaAsignaturas = asignaturas;
    listaUsuarios = usuarios;
    renderizarTabla();
  } catch (error) {
    aviso(error.message || 'Error al cargar distributivo', 'error');
    tbodyDistributivo.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; color: var(--color-error); padding: var(--espacio-l);">
          ${escapar(error.message || 'Error al conectar con el servidor')}
        </td>
      </tr>
    `;
  } finally {
    cargando(false);
  }
}

// Renderizar tabla de grupos
function renderizarTabla() {
  if (listaDistributivo.length === 0) {
    tbodyDistributivo.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: var(--espacio-xl); color: var(--color-texto-suave);">
          No hay grupos registrados en el distributivo. Pulsa "+ Nuevo grupo" para crear uno.
        </td>
      </tr>
    `;
    return;
  }

  tbodyDistributivo.innerHTML = '';

  for (const grupo of listaDistributivo) {
    const asg = listaAsignaturas.find((a) => a.id === grupo.asignaturaId);
    const doc = listaUsuarios.find((u) => u.id === grupo.docenteId);
    const totalEstudiantes = Array.isArray(grupo.estudiantes) ? grupo.estudiantes.length : 0;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <strong>${escapar(asg?.nombre || grupo.asignaturaId)}</strong>
        <div style="font-size: var(--tamano-xs); color: var(--color-texto-suave);">${escapar(asg?.nivel || '')}</div>
      </td>
      <td style="text-align: center;">
        <span class="insignia insignia--secundario" style="font-weight: var(--peso-negrita);">${escapar(grupo.paralelo)}</span>
      </td>
      <td>${escapar(grupo.periodo)}</td>
      <td>
        ${doc ? `${escapar(doc.nombre)} ${escapar(doc.apellido)}` : '<span style="color: var(--color-error);">Sin docente</span>'}
        <div style="font-size: var(--tamano-xs); color: var(--color-texto-suave);">${escapar(doc?.correo || '')}</div>
      </td>
      <td style="text-align: center;">
        <span class="chip">${totalEstudiantes} ${totalEstudiantes === 1 ? 'estudiante' : 'estudiantes'}</span>
      </td>
      <td style="text-align: right;">
        <button type="button" class="btn btn--secundario btn--pequeno btn-editar" aria-label="Editar grupo paralelo ${escapar(grupo.paralelo)}">
          Editar
        </button>
        <button type="button" class="btn btn--peligro btn--pequeno btn-eliminar" aria-label="Eliminar grupo paralelo ${escapar(grupo.paralelo)}">
          Eliminar
        </button>
      </td>
    `;

    // Botón Editar
    tr.querySelector('.btn-editar').addEventListener('click', () => {
      abrirModalGrupo(grupo);
    });

    // Botón Eliminar
    tr.querySelector('.btn-eliminar').addEventListener('click', async () => {
      const confirmado = await confirmar(
        `¿Deseas eliminar el grupo paralelo "${grupo.paralelo}" (${asg?.nombre || grupo.asignaturaId})?`
      );
      if (!confirmado) return;

      cargando(true);
      try {
        await api.eliminar('distributivo', grupo.id);
        aviso('Grupo eliminado con éxito', 'exito');
        await cargarDatos();
      } catch (error) {
        aviso(error.message || 'Error al eliminar grupo', 'error');
      } finally {
        cargando(false);
      }
    });

    tbodyDistributivo.appendChild(tr);
  }
}

// Modal para crear o editar grupo de distributivo
async function abrirModalGrupo(grupo = null) {
  const esEdicion = Boolean(grupo);

  if (listaAsignaturas.length === 0) {
    aviso('Debes crear al menos una asignatura antes de gestionar el distributivo.', 'advertencia');
    return;
  }

  const docentes = listaUsuarios.filter((u) => u.rol === 'docente' && u.activo !== false);
  const estudiantes = listaUsuarios.filter((u) => u.rol === 'estudiante' && u.activo !== false);

  if (docentes.length === 0) {
    aviso('Debes tener al menos un docente activo registrado para asignar a un grupo.', 'advertencia');
    return;
  }

  const seleccionados = new Set(grupo?.estudiantes || []);

  const contenedor = document.createElement('div');
  contenedor.className = 'pila';
  contenedor.style.gap = 'var(--espacio-s)';

  // Opciones de Asignaturas
  const opcionesAsignaturas = listaAsignaturas
    .map(
      (a) =>
        `<option value="${escapar(a.id)}" ${grupo?.asignaturaId === a.id ? 'selected' : ''}>${escapar(a.nombre)}</option>`
    )
    .join('');

  // Opciones de Docentes
  const opcionesDocentes = docentes
    .map(
      (d) =>
        `<option value="${escapar(d.id)}" ${grupo?.docenteId === d.id ? 'selected' : ''}>${escapar(d.nombre)} ${escapar(d.apellido)} (${escapar(d.correo)})</option>`
    )
    .join('');

  contenedor.innerHTML = `
    <div class="campo">
      <label for="grupo-asignatura">Asignatura</label>
      <select id="grupo-asignatura" required>
        <option value="">-- Selecciona una asignatura --</option>
        ${opcionesAsignaturas}
      </select>
      <span class="campo__error" id="error-grupo-asignatura"></span>
    </div>

    <div class="fila" style="gap: var(--espacio-m);">
      <div class="campo" style="flex: 1;">
        <label for="grupo-paralelo">Paralelo</label>
        <input type="text" id="grupo-paralelo" placeholder="Ej. A" value="${escapar(grupo?.paralelo || '')}" required>
        <span class="campo__error" id="error-grupo-paralelo"></span>
      </div>
      <div class="campo" style="flex: 1;">
        <label for="grupo-periodo">Período lectivo</label>
        <input type="text" id="grupo-periodo" placeholder="Ej. 2026-2027" value="${escapar(grupo?.periodo || '2026-2027')}" required>
        <span class="campo__error" id="error-grupo-periodo"></span>
      </div>
    </div>

    <div class="campo">
      <label for="grupo-docente">Docente asignado</label>
      <select id="grupo-docente" required>
        <option value="">-- Selecciona un docente --</option>
        ${opcionesDocentes}
      </select>
      <span class="campo__error" id="error-grupo-docente"></span>
    </div>

    <div class="estudiantes-seleccion-caja">
      <label for="buscar-estudiante-modal" style="font-weight: var(--peso-seminegrita); font-size: var(--tamano-sm);">
        Estudiantes matriculados
      </label>
      <input type="search" id="buscar-estudiante-modal" placeholder="Buscar estudiante por nombre o correo..." aria-label="Buscar estudiante para matricular">
      <div class="estudiantes-barra-contador">
        <span>Selecciona los estudiantes que pertenecen a este grupo:</span>
        <strong id="contador-estudiantes-modal">${seleccionados.size} seleccionados</strong>
      </div>
      <div class="estudiantes-lista-scroll" id="lista-estudiantes-checklist" role="group" aria-label="Lista de estudiantes disponibles">
        <!-- Renderizado dinámico -->
      </div>
    </div>
  `;

  const selectAsignatura = contenedor.querySelector('#grupo-asignatura');
  const inputParalelo = contenedor.querySelector('#grupo-paralelo');
  const inputPeriodo = contenedor.querySelector('#grupo-periodo');
  const selectDocente = contenedor.querySelector('#grupo-docente');
  const inputBuscar = contenedor.querySelector('#buscar-estudiante-modal');
  const contadorTexto = contenedor.querySelector('#contador-estudiantes-modal');
  const contenedorChecklist = contenedor.querySelector('#lista-estudiantes-checklist');

  const errorAsignatura = contenedor.querySelector('#error-grupo-asignatura');
  const errorParalelo = contenedor.querySelector('#error-grupo-paralelo');
  const errorPeriodo = contenedor.querySelector('#error-grupo-periodo');
  const errorDocente = contenedor.querySelector('#error-grupo-docente');

  function renderizarChecklistEstudiantes() {
    const filtro = normalizar(inputBuscar.value.trim());
    const filtrados = estudiantes.filter((est) => {
      if (!filtro) return true;
      const texto = normalizar(`${est.nombre || ''} ${est.apellido || ''} ${est.correo || ''}`);
      return texto.includes(filtro);
    });

    if (filtrados.length === 0) {
      contenedorChecklist.innerHTML = `
        <div style="padding: var(--espacio-s); text-align: center; color: var(--color-texto-suave); font-size: var(--tamano-xs);">
          No se encontraron estudiantes coincidentes.
        </div>
      `;
      return;
    }

    contenedorChecklist.innerHTML = '';
    for (const est of filtrados) {
      const label = document.createElement('label');
      label.className = 'estudiante-fila-item';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = est.id;
      checkbox.checked = seleccionados.has(est.id);

      checkbox.addEventListener('change', () => {
        if (checkbox.checked) {
          seleccionados.add(est.id);
        } else {
          seleccionados.delete(est.id);
        }
        contadorTexto.textContent = `${seleccionados.size} seleccionados`;
      });

      const infoBox = document.createElement('div');
      infoBox.className = 'estudiante-info-label';
      infoBox.innerHTML = `
        <span class="estudiante-nombre">${escapar(est.nombre)} ${escapar(est.apellido)}</span>
        <span class="estudiante-correo">${escapar(est.correo)}</span>
      `;

      label.appendChild(checkbox);
      label.appendChild(infoBox);
      contenedorChecklist.appendChild(label);
    }
  }

  inputBuscar.addEventListener('input', renderizarChecklistEstudiantes);
  renderizarChecklistEstudiantes();

  const accionModal = await modal({
    titulo: esEdicion ? 'Editar Grupo de Distributivo' : 'Nuevo Grupo de Distributivo',
    contenido: contenedor,
    acciones: [
      { texto: 'Cancelar', valor: null, clase: 'btn--secundario' },
      { texto: esEdicion ? 'Actualizar grupo' : 'Crear grupo', valor: 'guardar', clase: 'btn--primario' }
    ]
  });

  if (accionModal === 'guardar') {
    const asignaturaId = selectAsignatura.value;
    const paralelo = inputParalelo.value.trim().toUpperCase();
    const periodo = inputPeriodo.value.trim();
    const docenteId = selectDocente.value;

    let tieneError = false;
    if (!asignaturaId) {
      errorAsignatura.textContent = 'Selecciona una asignatura';
      tieneError = true;
    }
    if (!paralelo) {
      errorParalelo.textContent = 'Ingresa el paralelo';
      tieneError = true;
    }
    if (!periodo) {
      errorPeriodo.textContent = 'Ingresa el período lectivo';
      tieneError = true;
    }
    if (!docenteId) {
      errorDocente.textContent = 'Selecciona un docente';
      tieneError = true;
    }

    if (tieneError) {
      aviso('Por favor completa todos los campos del formulario', 'advertencia');
      return;
    }

    cargando(true);
    try {
      const payload = {
        asignaturaId,
        paralelo,
        periodo,
        docenteId,
        estudiantes: Array.from(seleccionados)
      };

      if (esEdicion) {
        await api.actualizar('distributivo', grupo.id, payload);
        aviso('Grupo de distributivo actualizado con éxito', 'exito');
      } else {
        await api.crear('distributivo', payload);
        aviso('Grupo de distributivo creado con éxito', 'exito');
      }
      await cargarDatos();
    } catch (error) {
      aviso(error.message || 'Error al guardar el grupo', 'error');
    } finally {
      cargando(false);
    }
  }
}

btnNuevoGrupo.addEventListener('click', () => abrirModalGrupo());

await cargarDatos();
