// publico/js/modulos/editor-contenidos.js · Editor de unidades y temas curriculares
import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import { aviso, modal, cargando, escapar } from '../nucleo/ui.js';

await montarPlantilla({ titulo: 'Contenidos', roles: ['docente', 'admin'] });

const selectorAsignatura = document.getElementById('selector-asignatura');
const btnNuevaUnidad = document.getElementById('btn-nueva-unidad');
const listaUnidadesContenedor = document.getElementById('lista-unidades');

const subtituloUnidad = document.getElementById('subtitulo-unidad-seleccionada');
const btnNuevoTema = document.getElementById('btn-nuevo-tema');
const listaTemasContenedor = document.getElementById('lista-temas');

let misAsignaturas = [];
let unidadSeleccionada = null;
let unidadesDeAsignatura = [];
let temasDeUnidad = [];

// 1. Cargar las asignaturas permitidas para el usuario
async function cargarAsignaturas() {
  cargando(true);
  try {
    misAsignaturas = await api.listar('asignaturas');

    if (misAsignaturas.length === 0) {
      selectorAsignatura.innerHTML = '<option value="">No tienes asignaturas asignadas</option>';
      listaUnidadesContenedor.innerHTML = `
        <div style="padding: var(--espacio-l); text-align: center; color: var(--color-texto-suave);">
          No se encontraron asignaturas asociadas a tu cuenta.
        </div>
      `;
      btnNuevaUnidad.disabled = true;
      return;
    }

    selectorAsignatura.innerHTML = misAsignaturas
      .map((a) => `<option value="${escapar(a.id)}">${escapar(a.nombre)}</option>`)
      .join('');

    btnNuevaUnidad.disabled = false;
    await cambiarAsignatura(misAsignaturas[0].id);
  } catch (error) {
    aviso(error.message || 'Error al cargar asignaturas', 'error');
  } finally {
    cargando(false);
  }
}

// 2. Cambiar de asignatura activa y cargar sus unidades
async function cambiarAsignatura(asignaturaId) {
  if (!asignaturaId) return;

  unidadSeleccionada = null;
  subtituloUnidad.textContent = 'Ninguna unidad seleccionada';
  btnNuevoTema.disabled = true;
  listaTemasContenedor.innerHTML = `
    <div style="padding: var(--espacio-xl); text-align: center; color: var(--color-texto-suave);">
      Selecciona una unidad a la izquierda para visualizar y gestionar sus temas.
    </div>
  `;

  await cargarUnidades(asignaturaId);
}

// 3. Cargar unidades de la asignatura
async function cargarUnidades(asignaturaId) {
  cargando(true);
  try {
    const todasLasUnidades = await api.listar('unidades');
    unidadesDeAsignatura = todasLasUnidades
      .filter((u) => u.asignaturaId === asignaturaId)
      .sort((a, b) => (Number(a.orden) || 0) - (Number(b.orden) || 0));

    renderizarUnidades();

    // Si había una unidad seleccionada previa, restaurarla si aún existe
    if (unidadSeleccionada) {
      const encontrada = unidadesDeAsignatura.find((u) => u.id === unidadSeleccionada.id);
      if (encontrada) {
        seleccionarUnidad(encontrada);
      }
    }
  } catch (error) {
    aviso(error.message || 'Error al cargar unidades', 'error');
  } finally {
    cargando(false);
  }
}

// 4. Renderizar lista de unidades
function renderizarUnidades() {
  if (unidadesDeAsignatura.length === 0) {
    listaUnidadesContenedor.innerHTML = `
      <div style="padding: var(--espacio-l); text-align: center; color: var(--color-texto-suave);">
        Esta asignatura no tiene unidades registradas. Pulsa "+ Nueva unidad".
      </div>
    `;
    return;
  }

  listaUnidadesContenedor.innerHTML = '';

  unidadesDeAsignatura.forEach((unidad, index) => {
    const esActiva = unidadSeleccionada && unidadSeleccionada.id === unidad.id;
    const esPrimera = index === 0;
    const esUltima = index === unidadesDeAsignatura.length - 1;
    const esVisible = unidad.visible !== false;

    const div = document.createElement('div');
    div.className = `unidad-item ${esActiva ? 'unidad-item--activa' : ''}`;
    div.setAttribute('role', 'listitem');
    div.setAttribute('tabindex', '0');

    div.innerHTML = `
      <div class="unidad-item__principal">
        <div class="unidad-item__info">
          <span class="unidad-item__orden">${unidad.orden || index + 1}</span>
          <span class="unidad-item__titulo">${escapar(unidad.titulo)}</span>
        </div>
        <span class="insignia ${esVisible ? 'insignia--exito' : 'insignia--advertencia'}">
          ${esVisible ? 'Visible' : 'Oculta'}
        </span>
      </div>
      <div class="unidad-item__acciones">
        <button type="button" class="btn btn--secundario btn--pequeno btn-renombrar" title="Renombrar unidad">
          Renombrar
        </button>
        <button type="button" class="btn btn--secundario btn--pequeno btn-toggle-visible" title="${esVisible ? 'Ocultar a estudiantes' : 'Mostrar a estudiantes'}">
          ${esVisible ? 'Ocultar' : 'Mostrar'}
        </button>
        <div class="fila" style="gap: 2px; margin-left: auto;">
          <button type="button" class="btn btn--secundario btn-flecha btn-subir" title="Subir orden" ${esPrimera ? 'disabled' : ''}>
            ▲
          </button>
          <button type="button" class="btn btn--secundario btn-flecha btn-bajar" title="Bajar orden" ${esUltima ? 'disabled' : ''}>
            ▼
          </button>
        </div>
      </div>
    `;

    // Seleccionar unidad al hacer clic en el contenedor (pero no en sus botones)
    div.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      seleccionarUnidad(unidad);
    });

    // Enter / Espacio para seleccionar por teclado
    div.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        if (e.target.closest('button')) return;
        e.preventDefault();
        seleccionarUnidad(unidad);
      }
    });

    // Acción Renombrar
    div.querySelector('.btn-renombrar').addEventListener('click', async (e) => {
      e.stopPropagation();
      await renombrarUnidad(unidad);
    });

    // Acción Ocultar / Mostrar
    div.querySelector('.btn-toggle-visible').addEventListener('click', async (e) => {
      e.stopPropagation();
      cargando(true);
      try {
        await api.actualizar('unidades', unidad.id, { visible: !esVisible });
        aviso(`Unidad ${!esVisible ? 'visible' : 'oculta'} para estudiantes`, 'info');
        await cargarUnidades(selectorAsignatura.value);
      } catch (err) {
        aviso(err.message || 'Error al actualizar visibilidad', 'error');
      } finally {
        cargando(false);
      }
    });

    // Acción Subir
    div.querySelector('.btn-subir').addEventListener('click', async (e) => {
      e.stopPropagation();
      if (esPrimera) return;
      const anterior = unidadesDeAsignatura[index - 1];
      await intercambiarOrdenUnidades(unidad, anterior);
    });

    // Acción Bajar
    div.querySelector('.btn-bajar').addEventListener('click', async (e) => {
      e.stopPropagation();
      if (esUltima) return;
      const siguiente = unidadesDeAsignatura[index + 1];
      await intercambiarOrdenUnidades(unidad, siguiente);
    });

    listaUnidadesContenedor.appendChild(div);
  });
}

// 5. Intercambiar orden de dos unidades
async function intercambiarOrdenUnidades(u1, u2) {
  cargando(true);
  try {
    const orden1 = Number(u1.orden) || 1;
    const orden2 = Number(u2.orden) || 2;
    // Si tenían el mismo orden, asegurar diferencia
    const nuevoOrden1 = orden1 === orden2 ? orden2 + 1 : orden2;
    const nuevoOrden2 = orden1 === orden2 ? orden1 : orden1;

    await Promise.all([
      api.actualizar('unidades', u1.id, { orden: nuevoOrden1 }),
      api.actualizar('unidades', u2.id, { orden: nuevoOrden2 })
    ]);

    await cargarUnidades(selectorAsignatura.value);
  } catch (error) {
    aviso(error.message || 'Error al reordenar unidades', 'error');
  } finally {
    cargando(false);
  }
}

// 6. Modal para agregar nueva unidad
async function modalNuevaUnidad() {
  const asignaturaId = selectorAsignatura.value;
  if (!asignaturaId) {
    aviso('Selecciona una asignatura primero', 'advertencia');
    return;
  }

  const contenedor = document.createElement('div');
  contenedor.className = 'pila';
  contenedor.innerHTML = `
    <div class="campo">
      <label for="input-titulo-unidad">Título de la unidad</label>
      <input type="text" id="input-titulo-unidad" placeholder="Ej. Fundamentos de Prevención" required autofocus>
      <span class="campo__error" id="error-titulo-unidad"></span>
    </div>
  `;

  const inputTitulo = contenedor.querySelector('#input-titulo-unidad');
  const errorTitulo = contenedor.querySelector('#error-titulo-unidad');

  const resultado = await modal({
    titulo: 'Nueva Unidad',
    contenido: contenedor,
    acciones: [
      { texto: 'Cancelar', valor: null, clase: 'btn--secundario' },
      { texto: 'Crear unidad', valor: 'crear', clase: 'btn--primario' }
    ]
  });

  if (resultado === 'crear') {
    const titulo = inputTitulo.value.trim();
    if (!titulo) {
      errorTitulo.textContent = 'El título de la unidad es obligatorio';
      aviso('Ingresa un título para la unidad', 'advertencia');
      return;
    }

    cargando(true);
    try {
      const maxOrden = unidadesDeAsignatura.reduce(
        (max, u) => Math.max(max, Number(u.orden) || 0),
        0
      );
      const nueva = await api.crear('unidades', {
        asignaturaId,
        titulo,
        orden: maxOrden + 1,
        visible: true
      });

      aviso('Unidad creada con éxito', 'exito');
      await cargarUnidades(asignaturaId);
      seleccionarUnidad(nueva);
    } catch (error) {
      aviso(error.message || 'Error al crear la unidad', 'error');
    } finally {
      cargando(false);
    }
  }
}

// 7. Modal para renombrar unidad
async function renombrarUnidad(unidad) {
  const contenedor = document.createElement('div');
  contenedor.className = 'pila';
  contenedor.innerHTML = `
    <div class="campo">
      <label for="input-renombrar-unidad">Título de la unidad</label>
      <input type="text" id="input-renombrar-unidad" value="${escapar(unidad.titulo)}" required autofocus>
      <span class="campo__error" id="error-renombrar-unidad"></span>
    </div>
  `;

  const inputTitulo = contenedor.querySelector('#input-renombrar-unidad');
  const errorTitulo = contenedor.querySelector('#error-renombrar-unidad');

  const resultado = await modal({
    titulo: 'Renombrar Unidad',
    contenido: contenedor,
    acciones: [
      { texto: 'Cancelar', valor: null, clase: 'btn--secundario' },
      { texto: 'Guardar cambios', valor: 'guardar', clase: 'btn--primario' }
    ]
  });

  if (resultado === 'guardar') {
    const nuevoTitulo = inputTitulo.value.trim();
    if (!nuevoTitulo) {
      errorTitulo.textContent = 'El título es obligatorio';
      aviso('Ingresa un título válido', 'advertencia');
      return;
    }

    cargando(true);
    try {
      await api.actualizar('unidades', unidad.id, { titulo: nuevoTitulo });
      unidad.titulo = nuevoTitulo;
      aviso('Unidad renombrada con éxito', 'exito');
      await cargarUnidades(selectorAsignatura.value);
    } catch (error) {
      aviso(error.message || 'Error al renombrar unidad', 'error');
    } finally {
      cargando(false);
    }
  }
}

// 8. Seleccionar unidad y cargar sus temas
async function seleccionarUnidad(unidad) {
  unidadSeleccionada = unidad;
  subtituloUnidad.textContent = `Unidad: ${unidad.titulo}`;
  btnNuevoTema.disabled = false;

  // Actualizar clase activa en la lista de unidades
  renderizarUnidades();
  await cargarTemas(unidad.id);
}

// 9. Cargar temas de la unidad seleccionada
async function cargarTemas(unidadId) {
  cargando(true);
  try {
    const todosLosTemas = await api.listar('temas');
    temasDeUnidad = todosLosTemas
      .filter((t) => t.unidadId === unidadId)
      .sort((a, b) => (Number(a.orden) || 0) - (Number(b.orden) || 0));

    renderizarTemas();
  } catch (error) {
    aviso(error.message || 'Error al cargar temas', 'error');
  } finally {
    cargando(false);
  }
}

// 10. Renderizar temas de la unidad
function renderizarTemas() {
  if (temasDeUnidad.length === 0) {
    listaTemasContenedor.innerHTML = `
      <div style="padding: var(--espacio-xl); text-align: center; color: var(--color-texto-suave);">
        Esta unidad aún no tiene temas de estudio. Pulsa "+ Nuevo tema".
      </div>
    `;
    return;
  }

  listaTemasContenedor.innerHTML = '';

  temasDeUnidad.forEach((tema, index) => {
    const esPrimero = index === 0;
    const esUltimo = index === temasDeUnidad.length - 1;
    const esPublicado = tema.estado === 'publicado';

    const div = document.createElement('div');
    div.className = 'tema-item';
    div.setAttribute('role', 'listitem');

    div.innerHTML = `
      <div class="tema-item__principal">
        <div class="tema-item__info">
          <span class="tema-item__orden">${tema.orden || index + 1}</span>
          <span class="tema-item__titulo">${escapar(tema.titulo)}</span>
        </div>
        <button type="button" class="btn btn--pequeno btn-toggle-estado ${esPublicado ? 'insignia--exito' : 'insignia--advertencia'}" title="Clic para alternar estado" style="cursor: pointer; border: none;">
          ${esPublicado ? 'Publicado' : 'Borrador'}
        </button>
      </div>
      <div class="tema-item__acciones">
        <div class="fila" style="gap: var(--espacio-xs);">
          <button type="button" class="btn btn--secundario btn-flecha btn-subir-tema" title="Subir tema" ${esPrimero ? 'disabled' : ''}>
            ▲
          </button>
          <button type="button" class="btn btn--secundario btn-flecha btn-bajar-tema" title="Bajar tema" ${esUltimo ? 'disabled' : ''}>
            ▼
          </button>
        </div>
        <a href="/paginas/editor-tema.html?id=${encodeURIComponent(tema.id)}" class="btn btn--primario btn--pequeno" aria-label="Editar ficha didáctica de ${escapar(tema.titulo)}">
          Editar ficha
        </a>
      </div>
    `;

    // Alternar estado borrador / publicado
    div.querySelector('.btn-toggle-estado').addEventListener('click', async () => {
      const nuevoEstado = esPublicado ? 'borrador' : 'publicado';
      cargando(true);
      try {
        await api.actualizar('temas', tema.id, { estado: nuevoEstado });
        aviso(`Tema marcado como ${nuevoEstado}`, 'info');
        await cargarTemas(unidadSeleccionada.id);
      } catch (err) {
        aviso(err.message || 'Error al cambiar estado del tema', 'error');
      } finally {
        cargando(false);
      }
    });

    // Subir tema
    div.querySelector('.btn-subir-tema').addEventListener('click', async () => {
      if (esPrimero) return;
      const anterior = temasDeUnidad[index - 1];
      await intercambiarOrdenTemas(tema, anterior);
    });

    // Bajar tema
    div.querySelector('.btn-bajar-tema').addEventListener('click', async () => {
      if (esUltimo) return;
      const siguiente = temasDeUnidad[index + 1];
      await intercambiarOrdenTemas(tema, siguiente);
    });

    listaTemasContenedor.appendChild(div);
  });
}

// 11. Intercambiar orden de temas
async function intercambiarOrdenTemas(t1, t2) {
  cargando(true);
  try {
    const orden1 = Number(t1.orden) || 1;
    const orden2 = Number(t2.orden) || 2;
    const nuevoOrden1 = orden1 === orden2 ? orden2 + 1 : orden2;
    const nuevoOrden2 = orden1 === orden2 ? orden1 : orden1;

    await Promise.all([
      api.actualizar('temas', t1.id, { orden: nuevoOrden1 }),
      api.actualizar('temas', t2.id, { orden: nuevoOrden2 })
    ]);

    await cargarTemas(unidadSeleccionada.id);
  } catch (error) {
    aviso(error.message || 'Error al reordenar temas', 'error');
  } finally {
    cargando(false);
  }
}

// 12. Modal para agregar nuevo tema (solo título, estado "borrador")
async function modalNuevoTema() {
  if (!unidadSeleccionada) {
    aviso('Selecciona una unidad primero', 'advertencia');
    return;
  }

  const contenedor = document.createElement('div');
  contenedor.className = 'pila';
  contenedor.innerHTML = `
    <div class="campo">
      <label for="input-titulo-tema">Título del tema</label>
      <input type="text" id="input-titulo-tema" placeholder="Ej. Técnicas de Anclaje y Líneas de Vida" required autofocus>
      <span class="campo__error" id="error-titulo-tema"></span>
    </div>
  `;

  const inputTitulo = contenedor.querySelector('#input-titulo-tema');
  const errorTitulo = contenedor.querySelector('#error-titulo-tema');

  const resultado = await modal({
    titulo: 'Nuevo Tema',
    contenido: contenedor,
    acciones: [
      { texto: 'Cancelar', valor: null, clase: 'btn--secundario' },
      { texto: 'Crear tema', valor: 'crear', clase: 'btn--primario' }
    ]
  });

  if (resultado === 'crear') {
    const titulo = inputTitulo.value.trim();
    if (!titulo) {
      errorTitulo.textContent = 'El título del tema es obligatorio';
      aviso('Ingresa un título para el tema', 'advertencia');
      return;
    }

    cargando(true);
    try {
      const maxOrden = temasDeUnidad.reduce(
        (max, t) => Math.max(max, Number(t.orden) || 0),
        0
      );

      await api.crear('temas', {
        unidadId: unidadSeleccionada.id,
        titulo,
        orden: maxOrden + 1,
        estado: 'borrador',
        objetivos: [],
        resumen: '',
        ejemplos: [],
        erroresFrecuentes: [],
        preguntasGuia: [],
        recursos: [],
        palabrasClave: [],
        dificultad: 'intermedio',
        fuentes: ''
      });

      aviso('Tema creado con éxito en estado borrador', 'exito');
      await cargarTemas(unidadSeleccionada.id);
    } catch (error) {
      aviso(error.message || 'Error al crear tema', 'error');
    } finally {
      cargando(false);
    }
  }
}

// Eventos de controles
selectorAsignatura.addEventListener('change', (e) => {
  cambiarAsignatura(e.target.value);
});

btnNuevaUnidad.addEventListener('click', modalNuevaUnidad);
btnNuevoTema.addEventListener('click', modalNuevoTema);

await cargarAsignaturas();
