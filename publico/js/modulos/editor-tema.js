// publico/js/modulos/editor-tema.js · Editor de ficha didáctica y glosario del tema
import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import { aviso, confirmar, modal, cargando, escapar } from '../nucleo/ui.js';
import { parametro, normalizar, formatoBasico } from '../nucleo/util.js';

await montarPlantilla({ titulo: 'Ficha del tema', roles: ['docente', 'admin'] });

const temaId = parametro('id');

// Elementos de la interfaz - Barra superior
const tituloPagina = document.getElementById('titulo-pagina-tema');
const migaTema = document.getElementById('miga-tema');
const enlaceVolver = document.getElementById('enlace-volver');
const btnGuardarTema = document.getElementById('btn-guardar-tema');
const alertaCambios = document.getElementById('alerta-cambios');

// Elementos - Formulario Ficha
const formFicha = document.getElementById('form-ficha-tema');
const campoTitulo = document.getElementById('tema-titulo');
const campoEstado = document.getElementById('tema-estado');
const campoDificultad = document.getElementById('tema-dificultad');
const campoResumen = document.getElementById('tema-resumen');
const contadorResumen = document.getElementById('contador-resumen');
const btnToggleVistaResumen = document.getElementById('btn-toggle-vista-resumen');
const vistaPreviaResumen = document.getElementById('vista-previa-resumen');
const campoPalabras = document.getElementById('tema-palabras');
const campoFuentes = document.getElementById('tema-fuentes');

// Elementos - Recursos
const selectRecursoTipo = document.getElementById('recurso-tipo');
const inputRecursoTitulo = document.getElementById('recurso-titulo');
const inputRecursoUrl = document.getElementById('recurso-url');
const fileInputSubir = document.getElementById('recurso-archivo-subir');
const btnAgregarRecurso = document.getElementById('btn-agregar-recurso');
const contenedorRecursos = document.getElementById('lista-recursos');

// Elementos - Glosario
const tbodyGlosario = document.getElementById('tbody-glosario');
const btnNuevoTermino = document.getElementById('btn-nuevo-termino');
const indTotalGlosario = document.getElementById('glo-total-indicador');
const indSeisGlosario = document.getElementById('glo-seis-indicador');
const badgeAptitud = document.getElementById('glo-aptitud-badge');

// Estado interno
let temaActual = null;
let hayCambiosSinGuardar = false;

let objetivos = [];
let ejemplos = [];
let erroresFrecuentes = [];
let preguntasGuia = [];
let recursos = [];
let glosarioTema = [];

function marcarCambio() {
  hayCambiosSinGuardar = true;
  alertaCambios.classList.remove('oculto');
}

function desmarcarCambio() {
  hayCambiosSinGuardar = false;
  alertaCambios.classList.add('oculto');
}

// Alerta de cierre de ventana con cambios sin guardar
window.addEventListener('beforeunload', (e) => {
  if (hayCambiosSinGuardar) {
    e.preventDefault();
    e.returnValue = '';
  }
});

// Enlace volver con confirmación si hay cambios
enlaceVolver.addEventListener('click', async (e) => {
  if (hayCambiosSinGuardar) {
    e.preventDefault();
    const seguro = await confirmar('Tienes cambios sin guardar en la ficha. ¿Deseas salir de todas formas?');
    if (seguro) {
      hayCambiosSinGuardar = false;
      window.location.href = enlaceVolver.href;
    }
  }
});

// Contar palabras en un texto
function contarPalabras(texto) {
  if (!texto || !texto.trim()) return 0;
  return texto.trim().split(/\s+/).filter(Boolean).length;
}

// 1. Cargar datos del tema, unidad, asignatura y glosario
async function inicializar() {
  if (!temaId) {
    aviso('No se especificó ningún tema para editar', 'error');
    tituloPagina.textContent = 'Tema no encontrado';
    btnGuardarTema.disabled = true;
    return;
  }

  cargando(true);
  try {
    temaActual = await api.obtener('temas', temaId);
    if (!temaActual) {
      throw new Error('El tema solicitado no existe');
    }

    // Cargar unidad y asignatura para la miga de pan
    const unidad = await api.obtener('unidades', temaActual.unidadId);
    const asignatura = unidad ? await api.obtener('asignaturas', unidad.asignaturaId) : null;

    migaTema.textContent = `${asignatura?.nombre || 'Asignatura'} > ${unidad?.titulo || 'Unidad'} > ${temaActual.titulo}`;
    tituloPagina.textContent = `Ficha: ${temaActual.titulo}`;

    // Poblar campos del tema
    campoTitulo.value = temaActual.titulo || '';
    campoEstado.value = temaActual.estado || 'borrador';
    campoDificultad.value = temaActual.dificultad || 'intermedio';
    campoResumen.value = temaActual.resumen || '';
    campoPalabras.value = Array.isArray(temaActual.palabrasClave) ? temaActual.palabrasClave.join(', ') : '';
    campoFuentes.value = temaActual.fuentes || '';

    objetivos = Array.isArray(temaActual.objetivos) ? [...temaActual.objetivos] : [];
    ejemplos = Array.isArray(temaActual.ejemplos) ? [...temaActual.ejemplos] : [];
    erroresFrecuentes = Array.isArray(temaActual.erroresFrecuentes) ? [...temaActual.erroresFrecuentes] : [];
    preguntasGuia = Array.isArray(temaActual.preguntasGuia) ? [...temaActual.preguntasGuia] : [];
    recursos = Array.isArray(temaActual.recursos) ? [...temaActual.recursos] : [];

    actualizarContadorResumen();
    renderizarListaDinamica('lista-objetivos', objetivos);
    renderizarListaDinamica('lista-ejemplos', ejemplos);
    renderizarListaDinamica('lista-errores', erroresFrecuentes);
    renderizarListaDinamica('lista-preguntas', preguntasGuia);
    renderizarRecursos();

    await cargarGlosario();
    desmarcarCambio();
  } catch (error) {
    aviso(error.message || 'Error al cargar la información del tema', 'error');
  } finally {
    cargando(false);
  }
}

// 2. Contador y vista previa del resumen
function actualizarContadorResumen() {
  const palabras = contarPalabras(campoResumen.value);
  contadorResumen.textContent = `${palabras} ${palabras === 1 ? 'palabra' : 'palabras'}`;

  if (palabras >= 300 && palabras <= 800) {
    contadorResumen.className = 'contador--valido';
  } else {
    contadorResumen.className = 'contador--invalido';
  }
}

campoResumen.addEventListener('input', () => {
  marcarCambio();
  actualizarContadorResumen();
  if (!vistaPreviaResumen.classList.contains('oculto')) {
    vistaPreviaResumen.innerHTML = formatoBasico(campoResumen.value);
  }
});

btnToggleVistaResumen.addEventListener('click', () => {
  const estaOculta = vistaPreviaResumen.classList.contains('oculto');
  if (estaOculta) {
    vistaPreviaResumen.innerHTML = formatoBasico(campoResumen.value) || '<p style="color: var(--color-texto-suave);">Sin contenido en el resumen.</p>';
    vistaPreviaResumen.classList.remove('oculto');
    btnToggleVistaResumen.textContent = 'Ocultar previa';
  } else {
    vistaPreviaResumen.classList.add('oculto');
    btnToggleVistaResumen.textContent = 'Vista previa';
  }
});

// Eventos de cambios en campos simples
campoTitulo.addEventListener('input', marcarCambio);
campoEstado.addEventListener('change', marcarCambio);
campoDificultad.addEventListener('change', marcarCambio);
campoPalabras.addEventListener('input', marcarCambio);
campoFuentes.addEventListener('input', marcarCambio);

// 3. Manejo de listas dinámicas (Objetivos, Ejemplos, Errores, Preguntas)
function configurarListaDinamica(idInput, idBoton, idLista, arreglo) {
  const input = document.getElementById(idInput);
  const boton = document.getElementById(idBoton);

  const agregarItem = () => {
    const texto = input.value.trim();
    if (!texto) return;
    arreglo.push(texto);
    input.value = '';
    renderizarListaDinamica(idLista, arreglo);
    marcarCambio();
  };

  boton.addEventListener('click', agregarItem);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      agregarItem();
    }
  });
}

function renderizarListaDinamica(idLista, arreglo) {
  const contenedor = document.getElementById(idLista);
  contenedor.innerHTML = '';

  arreglo.forEach((item, index) => {
    const li = document.createElement('li');
    li.className = 'item-dinamico-fila';
    li.innerHTML = `
      <span class="item-dinamico-texto">${escapar(item)}</span>
      <button type="button" class="btn btn--peligro btn--pequeno" aria-label="Eliminar ítem" style="padding: 1px 6px;">
        ✕
      </button>
    `;

    li.querySelector('button').addEventListener('click', () => {
      arreglo.splice(index, 1);
      renderizarListaDinamica(idLista, arreglo);
      marcarCambio();
    });

    contenedor.appendChild(li);
  });
}

configurarListaDinamica('input-nuevo-objetivo', 'btn-agregar-objetivo', 'lista-objetivos', objetivos);
configurarListaDinamica('input-nuevo-ejemplo', 'btn-agregar-ejemplo', 'lista-ejemplos', ejemplos);
configurarListaDinamica('input-nuevo-error', 'btn-agregar-error', 'lista-errores', erroresFrecuentes);
configurarListaDinamica('input-nueva-pregunta', 'btn-agregar-pregunta', 'lista-preguntas', preguntasGuia);

// 4. Recursos didácticos con subida de archivos (PDF/Imagen)
fileInputSubir.addEventListener('change', async (e) => {
  const archivo = e.target.files?.[0];
  if (!archivo) return;

  cargando(true);
  try {
    const res = await api.subir(archivo);
    inputRecursoUrl.value = res.url;
    if (!inputRecursoTitulo.value) {
      inputRecursoTitulo.value = archivo.name.replace(/\.[^/.]+$/, '');
    }
    aviso('Archivo subido con éxito', 'info');
  } catch (error) {
    aviso(error.message || 'Error al subir archivo', 'error');
  } finally {
    cargando(false);
    fileInputSubir.value = '';
  }
});

btnAgregarRecurso.addEventListener('click', () => {
  const tipo = selectRecursoTipo.value;
  const titulo = inputRecursoTitulo.value.trim();
  const url = inputRecursoUrl.value.trim();

  if (!titulo || !url) {
    aviso('Ingresa el título y la URL o archivo para el recurso', 'advertencia');
    return;
  }

  recursos.push({ tipo, titulo, url });
  inputRecursoTitulo.value = '';
  inputRecursoUrl.value = '';
  renderizarRecursos();
  marcarCambio();
});

function renderizarRecursos() {
  contenedorRecursos.innerHTML = '';

  if (recursos.length === 0) {
    contenedorRecursos.innerHTML = `
      <div style="font-size: var(--tamano-xs); color: var(--color-texto-suave); padding: var(--espacio-xs);">
        No hay recursos didácticos agregados a este tema.
      </div>
    `;
    return;
  }

  recursos.forEach((rec, idx) => {
    const div = document.createElement('div');
    div.className = 'recurso-fila';
    div.innerHTML = `
      <div class="recurso-info">
        <span class="insignia insignia--secundario" style="text-transform: uppercase;">${escapar(rec.tipo)}</span>
        <a href="${escapar(rec.url)}" target="_blank" rel="noopener noreferrer" class="recurso-link" title="${escapar(rec.url)}">
          ${escapar(rec.titulo)}
        </a>
      </div>
      <button type="button" class="btn btn--peligro btn--pequeno" aria-label="Eliminar recurso ${escapar(rec.titulo)}" style="padding: 1px 6px;">
        ✕
      </button>
    `;

    div.querySelector('button').addEventListener('click', () => {
      recursos.splice(idx, 1);
      renderizarRecursos();
      marcarCambio();
    });

    contenedorRecursos.appendChild(div);
  });
}

// 5. Guardar Ficha del Tema
btnGuardarTema.addEventListener('click', async () => {
  const titulo = campoTitulo.value.trim();
  if (!titulo) {
    aviso('El título del tema es obligatorio', 'advertencia');
    campoTitulo.focus();
    return;
  }

  cargando(true);
  try {
    const palabrasClave = campoPalabras.value
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);

    const payload = {
      titulo,
      estado: campoEstado.value,
      dificultad: campoDificultad.value,
      resumen: campoResumen.value.trim(),
      objetivos,
      ejemplos,
      erroresFrecuentes,
      preguntasGuia,
      recursos,
      palabrasClave,
      fuentes: campoFuentes.value.trim()
    };

    await api.actualizar('temas', temaId, payload);
    desmarcarCambio();
    aviso('Ficha del tema guardada correctamente', 'exito');
    tituloPagina.textContent = `Ficha: ${titulo}`;
  } catch (error) {
    aviso(error.message || 'Error al guardar la ficha del tema', 'error');
  } finally {
    cargando(false);
  }
});

// 6. Glosario de términos del tema
async function cargarGlosario() {
  try {
    const todosTerminos = await api.listar('glosario');
    glosarioTema = todosTerminos.filter((g) => g.temaId === temaId);
    renderizarGlosario();
  } catch (error) {
    tbodyGlosario.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; color: var(--color-error); padding: var(--espacio-m);">
          ${escapar(error.message || 'Error al cargar glosario')}
        </td>
      </tr>
    `;
  }
}

function esDeSeisLetras(termino) {
  const norm = normalizar(termino).replace(/[^A-ZÑ]/g, '');
  return norm.length === 6;
}

function renderizarGlosario() {
  const total = glosarioTema.length;
  const deSeis = glosarioTema.filter((t) => esDeSeisLetras(t.termino)).length;

  indTotalGlosario.textContent = total;
  indSeisGlosario.textContent = deSeis;

  const esApto = total >= 12 && deSeis >= 3;
  if (esApto) {
    badgeAptitud.className = 'insignia insignia--exito';
    badgeAptitud.textContent = '✔ Apto para juegos';
  } else {
    badgeAptitud.className = 'insignia insignia--advertencia';
    const faltanTotal = Math.max(0, 12 - total);
    const faltanSeis = Math.max(0, 3 - deSeis);
    badgeAptitud.textContent = `Requiere mín. 12 términos y 3 de 6 letras (faltan ${faltanTotal} térm., ${faltanSeis} de 6 letras)`;
  }

  if (total === 0) {
    tbodyGlosario.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; padding: var(--espacio-xl); color: var(--color-texto-suave);">
          No hay términos registrados en el glosario para este tema. Pulsa "+ Agregar término".
        </td>
      </tr>
    `;
    return;
  }

  tbodyGlosario.innerHTML = '';

  glosarioTema.forEach((term) => {
    const tieneSeis = esDeSeisLetras(term.termino);
    const tr = document.createElement('tr');

    tr.innerHTML = `
      <td>
        <div class="glosario-termino-celda">
          <span class="glosario-termino-nombre">${escapar(term.termino)}</span>
          ${tieneSeis ? '<span class="chip" style="font-size: 10px; padding: 1px 4px;">6L</span>' : ''}
        </div>
      </td>
      <td>
        <div>${escapar(term.definicion)}</div>
        <div class="glosario-conteo-palabras">${contarPalabras(term.definicion)}/25 palabras</div>
      </td>
      <td>
        <div>${escapar(term.pista)}</div>
        <div class="glosario-conteo-palabras">${contarPalabras(term.pista)}/10 palabras</div>
      </td>
      <td>
        <div>${escapar(term.retroalimentacion || '—')}</div>
      </td>
      <td style="text-align: right;">
        <button type="button" class="btn btn--secundario btn--pequeno btn-editar-termino">Editar</button>
        <button type="button" class="btn btn--peligro btn--pequeno btn-eliminar-termino">Eliminar</button>
      </td>
    `;

    // Editar término
    tr.querySelector('.btn-editar-termino').addEventListener('click', () => {
      abrirModalTermino(term);
    });

    // Eliminar término
    tr.querySelector('.btn-eliminar-termino').addEventListener('click', async () => {
      const seguro = await confirmar(`¿Eliminar el término "${term.termino}" del glosario?`);
      if (!seguro) return;

      cargando(true);
      try {
        await api.eliminar('glosario', term.id);
        aviso('Término eliminado del glosario', 'exito');
        await cargarGlosario();
      } catch (err) {
        aviso(err.message || 'Error al eliminar término', 'error');
      } finally {
        cargando(false);
      }
    });

    tbodyGlosario.appendChild(tr);
  });
}

// 7. Modal para agregar o editar término de glosario
async function abrirModalTermino(terminoExistente = null) {
  const esEdicion = Boolean(terminoExistente);

  const contenedor = document.createElement('div');
  contenedor.className = 'pila';
  contenedor.style.gap = 'var(--espacio-s)';

  contenedor.innerHTML = `
    <div class="campo">
      <label for="modal-glo-termino">Término (una sola palabra)</label>
      <input type="text" id="modal-glo-termino" value="${escapar(terminoExistente?.termino || '')}" placeholder="Ej. CASCOS" required autofocus>
      <span class="campo__error" id="error-glo-termino"></span>
    </div>

    <div class="campo">
      <div class="fila" style="justify-content: space-between;">
        <label for="modal-glo-definicion">Definición</label>
        <span id="contador-glo-definicion" style="font-size: var(--tamano-xs); color: var(--color-texto-suave);">0/25 palabras</span>
      </div>
      <textarea id="modal-glo-definicion" rows="3" placeholder="Definición concisa y didáctica..." required>${escapar(terminoExistente?.definicion || '')}</textarea>
      <span class="campo__error" id="error-glo-definicion"></span>
    </div>

    <div class="campo">
      <div class="fila" style="justify-content: space-between;">
        <label for="modal-glo-pista">Pista para juegos</label>
        <span id="contador-glo-pista" style="font-size: var(--tamano-xs); color: var(--color-texto-suave);">0/10 palabras</span>
      </div>
      <input type="text" id="modal-glo-pista" value="${escapar(terminoExistente?.pista || '')}" placeholder="Pista breve..." required>
      <span class="campo__error" id="error-glo-pista"></span>
    </div>

    <div class="campo">
      <label for="modal-glo-retro">Retroalimentación explicativa</label>
      <textarea id="modal-glo-retro" rows="2" placeholder="Explicación formativa adicional al resolver en juegos...">${escapar(terminoExistente?.retroalimentacion || '')}</textarea>
    </div>
  `;

  const inputTermino = contenedor.querySelector('#modal-glo-termino');
  const inputDefinicion = contenedor.querySelector('#modal-glo-definicion');
  const inputPista = contenedor.querySelector('#modal-glo-pista');
  const inputRetro = contenedor.querySelector('#modal-glo-retro');

  const contadorDef = contenedor.querySelector('#contador-glo-definicion');
  const contadorPista = contenedor.querySelector('#contador-glo-pista');

  const errorTermino = contenedor.querySelector('#error-glo-termino');
  const errorDef = contenedor.querySelector('#error-glo-definicion');
  const errorPista = contenedor.querySelector('#error-glo-pista');

  const actualizarContadoresModal = () => {
    const palDef = contarPalabras(inputDefinicion.value);
    contadorDef.textContent = `${palDef}/25 palabras`;
    contadorDef.style.color = palDef > 25 ? 'var(--color-error)' : 'var(--color-texto-suave)';

    const palPista = contarPalabras(inputPista.value);
    contadorPista.textContent = `${palPista}/10 palabras`;
    contadorPista.style.color = palPista > 10 ? 'var(--color-error)' : 'var(--color-texto-suave)';
  };

  inputDefinicion.addEventListener('input', actualizarContadoresModal);
  inputPista.addEventListener('input', actualizarContadoresModal);
  actualizarContadoresModal();

  const respuestaModal = await modal({
    titulo: esEdicion ? 'Editar Término del Glosario' : 'Nuevo Término del Glosario',
    contenido: contenedor,
    acciones: [
      { texto: 'Cancelar', valor: null, clase: 'btn--secundario' },
      { texto: esEdicion ? 'Actualizar' : 'Guardar término', valor: 'guardar', clase: 'btn--primario' }
    ]
  });

  if (respuestaModal === 'guardar') {
    const termino = inputTermino.value.trim().toUpperCase();
    const definicion = inputDefinicion.value.trim();
    const pista = inputPista.value.trim();
    const retroalimentacion = inputRetro.value.trim();

    let tieneError = false;
    if (!termino) {
      errorTermino.textContent = 'El término es obligatorio';
      tieneError = true;
    } else if (/\s/.test(termino)) {
      errorTermino.textContent = 'El término debe ser de una sola palabra sin espacios';
      tieneError = true;
    }

    const cantPalDef = contarPalabras(definicion);
    if (!definicion) {
      errorDef.textContent = 'La definición es obligatoria';
      tieneError = true;
    } else if (cantPalDef > 25) {
      errorDef.textContent = 'La definición no debe superar las 25 palabras';
      tieneError = true;
    }

    const cantPalPista = contarPalabras(pista);
    if (!pista) {
      errorPista.textContent = 'La pista es obligatoria';
      tieneError = true;
    } else if (cantPalPista > 10) {
      errorPista.textContent = 'La pista no debe superar las 10 palabras';
      tieneError = true;
    }

    if (tieneError) {
      aviso('Por favor corrige los errores del término', 'advertencia');
      return;
    }

    cargando(true);
    try {
      const payload = {
        temaId,
        termino,
        definicion,
        pista,
        retroalimentacion,
        origen: 'docente',
        estado: 'aprobado'
      };

      if (esEdicion) {
        await api.actualizar('glosario', terminoExistente.id, payload);
        aviso('Término actualizado con éxito', 'exito');
      } else {
        await api.crear('glosario', payload);
        aviso('Término agregado al glosario', 'exito');
      }

      await cargarGlosario();
    } catch (err) {
      aviso(err.message || 'Error al guardar término de glosario', 'error');
    } finally {
      cargando(false);
    }
  }
}

btnNuevoTermino.addEventListener('click', () => abrirModalTermino());

await inicializar();
