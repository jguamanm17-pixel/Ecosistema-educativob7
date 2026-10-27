// publico/js/modulos/banco-preguntas.js · Gestión y generación con IA del banco de preguntas
import { montarPlantilla } from '../nucleo/plantilla.js';
import { usuarioActual } from '../nucleo/sesion.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';

// Estado global del módulo
let usuario = null;
let temas = [];
let temaActualId = null;
let nivelActivo = 1;
let todasPreguntas = [];
let propuestasIa = [];
let preguntaEnEdicion = null;

const NOMBRES_NIVELES = {
  1: '1 · Recordar',
  2: '2 · Comprender',
  3: '3 · Aplicar',
  4: '4 · Analizar',
  5: '5 · Evaluar'
};

/**
 * Inicialización principal de la página
 */
async function iniciar() {
  await montarPlantilla({ titulo: 'Banco de preguntas', roles: ['docente', 'admin'] });
  usuario = usuarioActual();

  if (usuario?.rol === 'admin') {
    const btnCfg = document.getElementById('btn-config-ia');
    if (btnCfg) btnCfg.hidden = false;
  }

  conectarEventos();
  await cargarTemas();
}

/**
 * Conecta los escuchadores de eventos del DOM
 */
function conectarEventos() {
  const selectorTema = document.getElementById('selector-tema');
  selectorTema.addEventListener('change', (e) => {
    cambiarTema(e.target.value);
  });

  const pestanas = document.getElementById('pestanas-niveles');
  pestanas.addEventListener('click', (e) => {
    const tab = e.target.closest('.banco-tab');
    if (tab && tab.dataset.nivel) {
      cambiarNivel(Number(tab.dataset.nivel));
    }
  });

  document.getElementById('btn-nueva-pregunta').addEventListener('click', () => {
    abrirModalPregunta();
  });

  document.getElementById('btn-cancelar-modal').addEventListener('click', () => {
    cerrarModalPregunta();
  });

  document.getElementById('form-pregunta').addEventListener('submit', (e) => {
    e.preventDefault();
    guardarPregunta();
  });

  document.getElementById('pregunta-tipo').addEventListener('change', (e) => {
    renderizarSeccionRespuestas(e.target.value);
  });

  // Modal IA
  const btnIa = document.getElementById('btn-generar-ia');
  btnIa.addEventListener('click', () => {
    abrirModalIa();
  });

  document.getElementById('btn-cerrar-ia').addEventListener('click', () => {
    cerrarModalIa();
  });

  document.getElementById('btn-ejecutar-ia').addEventListener('click', () => {
    ejecutarGeneracionIa();
  });

  document.getElementById('btn-finalizar-ia').addEventListener('click', () => {
    cerrarModalIa();
    cargarPreguntasTema();
  });

  document.getElementById('btn-aprobar-todas-ia').addEventListener('click', () => {
    aprobarTodasPropuestasIa();
  });

  // Modal de Configuración de IA (admin)
  const btnConfigIa = document.getElementById('btn-config-ia');
  if (btnConfigIa) {
    btnConfigIa.addEventListener('click', () => abrirModalConfigIa());
  }

  document.getElementById('btn-cerrar-config-ia')?.addEventListener('click', () => {
    cerrarModalConfigIa();
  });

  document.getElementById('btn-toggle-clave')?.addEventListener('click', () => {
    toggleVisibilidadClave();
  });

  document.getElementById('form-config-ia')?.addEventListener('submit', (e) => {
    e.preventDefault();
    guardarConfigIa();
  });

  document.getElementById('btn-probar-ia')?.addEventListener('click', () => {
    probarConexionIa();
  });
}

/**
 * Carga los temas a los que el docente o admin tiene acceso
 */
async function cargarTemas() {
  try {
    ui.cargando(true);
    const [listaTemas, listaUnidades, listaAsignaturas] = await Promise.all([
      api.listar('temas'),
      api.listar('unidades'),
      api.listar('asignaturas')
    ]);

    const mapaAsignaturas = new Map(listaAsignaturas.map((a) => [a.id, a.nombre]));
    const mapaUnidades = new Map(listaUnidades.map((u) => [u.id, u]));

    temas = listaTemas.map((t) => {
      const u = mapaUnidades.get(t.unidadId);
      const asgNombre = u ? (mapaAsignaturas.get(u.asignaturaId) || 'Asignatura') : '';
      return {
        ...t,
        etiquetaCompleta: `${asgNombre ? `[${asgNombre}] ` : ''}${t.titulo}`
      };
    });

    const selectorTema = document.getElementById('selector-tema');
    selectorTema.innerHTML = '';

    if (temas.length === 0) {
      selectorTema.innerHTML = '<option value="">No tienes temas asignados para gestionar preguntas</option>';
      document.getElementById('btn-nueva-pregunta').disabled = true;
      document.getElementById('btn-generar-ia').disabled = true;
      ui.cargando(false);
      return;
    }

    temas.forEach((t) => {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = t.etiquetaCompleta;
      selectorTema.appendChild(opt);
    });

    // Selección por parámetro ?temaId= o el primero
    const paramTemaId = util.parametro('temaId');
    if (paramTemaId && temas.some((t) => t.id === paramTemaId)) {
      selectorTema.value = paramTemaId;
    }

    document.getElementById('btn-nueva-pregunta').disabled = false;
    document.getElementById('btn-generar-ia').disabled = false;

    await cambiarTema(selectorTema.value);
  } catch (err) {
    ui.aviso(`Error al cargar temas: ${err.message}`, 'error');
  } finally {
    ui.cargando(false);
  }
}

/**
 * Cambia el tema seleccionado y recarga sus preguntas
 * @param {string} temaId
 */
async function cambiarTema(temaId) {
  if (!temaId) return;
  temaActualId = temaId;
  await cargarPreguntasTema();
}

/**
 * Consulta todas las preguntas del tema seleccionado y actualiza la vista
 */
async function cargarPreguntasTema() {
  if (!temaActualId) return;
  try {
    ui.cargando(true);
    todasPreguntas = await api.listar('preguntas', { temaId: temaActualId });
    actualizarContadoresPestanas();
    renderizarListaNivel();
  } catch (err) {
    ui.aviso(`Error al cargar preguntas: ${err.message}`, 'error');
  } finally {
    ui.cargando(false);
  }
}

/**
 * Cambia la pestaña de nivel activa
 * @param {number} nivel
 */
function cambiarNivel(nivel) {
  nivelActivo = nivel;

  const tabs = document.querySelectorAll('.banco-tab');
  tabs.forEach((tab) => {
    const esActivo = Number(tab.dataset.nivel) === nivel;
    tab.classList.toggle('activo', esActivo);
    tab.setAttribute('aria-selected', esActivo ? 'true' : 'false');
    tab.setAttribute('tabindex', esActivo ? '0' : '-1');
  });

  renderizarListaNivel();
}

/**
 * Actualiza los contadores de preguntas aprobadas en cada pestaña
 */
function actualizarContadoresPestanas() {
  for (let n = 1; n <= 5; n++) {
    const aprobadasNivel = todasPreguntas.filter(
      (p) => Number(p.nivel) === n && p.estado === 'aprobado'
    ).length;
    const badge = document.getElementById(`contador-nivel-${n}`);
    if (badge) {
      badge.textContent = aprobadasNivel;
    }
  }
}

/**
 * Renderiza la lista de preguntas para el nivel activo y el aviso de < 20
 */
function renderizarListaNivel() {
  const preguntasNivel = todasPreguntas.filter((p) => Number(p.nivel) === nivelActivo);
  const aprobadasNivel = preguntasNivel.filter((p) => p.estado === 'aprobado').length;

  // Manejo de la alerta de menos de 20 preguntas aprobadas
  const alerta = document.getElementById('alerta-insuficientes');
  const mensajeAlerta = document.getElementById('mensaje-insuficientes');

  if (aprobadasNivel < 20) {
    alerta.hidden = false;
    mensajeAlerta.textContent = `Actualmente hay ${aprobadasNivel} de 20 preguntas aprobadas requeridas en este nivel.`;
  } else {
    alerta.hidden = true;
  }

  const contenedor = document.getElementById('lista-preguntas');
  contenedor.innerHTML = '';

  if (preguntasNivel.length === 0) {
    contenedor.innerHTML = `
      <div class="vacio">
        <h3>Sin preguntas en este nivel</h3>
        <p>No se han registrado preguntas para el Nivel ${nivelActivo} (${NOMBRES_NIVELES[nivelActivo] || ''}).</p>
        <p>Puedes agregar una nueva pregunta manual o generarlas con la asistencia de la Inteligencia Artificial.</p>
      </div>
    `;
    return;
  }

  preguntasNivel.forEach((p) => {
    const tarjeta = document.createElement('article');
    tarjeta.className = 'pregunta-tarjeta';

    // Cabecera
    const cabecera = document.createElement('div');
    cabecera.className = 'pregunta-cabecera';

    const etiquetas = document.createElement('div');
    etiquetas.className = 'pregunta-etiquetas';

    const nombreTipo = p.tipo === 'opcion'
      ? 'Opción múltiple'
      : (p.tipo === 'vf' ? 'Verdadero / Falso' : 'Completar');

    const chipTipo = document.createElement('span');
    chipTipo.className = 'chip-tipo';
    chipTipo.textContent = nombreTipo;
    etiquetas.appendChild(chipTipo);

    const chipEstado = document.createElement('span');
    chipEstado.className = `chip-estado chip-estado--${p.estado || 'aprobado'}`;
    chipEstado.textContent = p.estado === 'borrador' ? 'Borrador' : 'Aprobado';
    etiquetas.appendChild(chipEstado);

    const chipOrigen = document.createElement('span');
    chipOrigen.className = 'chip-origen';
    chipOrigen.textContent = p.origen === 'ia' ? '🤖 IA' : 'Docente';
    etiquetas.appendChild(chipOrigen);

    cabecera.appendChild(etiquetas);
    tarjeta.appendChild(cabecera);

    // Enunciado
    const enunciado = document.createElement('div');
    enunciado.className = 'pregunta-enunciado';
    enunciado.innerHTML = util.formatoBasico(p.enunciado);
    tarjeta.appendChild(enunciado);

    // Opciones o respuesta correcta
    if (p.tipo === 'opcion' && Array.isArray(p.opciones)) {
      const listaOpciones = document.createElement('ul');
      listaOpciones.className = 'pregunta-opciones-lista';

      p.opciones.forEach((opc, idx) => {
        const item = document.createElement('li');
        const esCorrecta = Number(p.correcta) === idx;
        item.className = `pregunta-opcion-item ${esCorrecta ? 'es-correcta' : ''}`;

        const letra = String.fromCharCode(65 + idx);
        item.innerHTML = `
          <span class="pregunta-opcion-badge">${esCorrecta ? '✓' : letra}</span>
          <span>${ui.escapar(opc)}</span>
        `;
        listaOpciones.appendChild(item);
      });
      tarjeta.appendChild(listaOpciones);
    } else if (p.tipo === 'vf') {
      const listaOpciones = document.createElement('ul');
      listaOpciones.className = 'pregunta-opciones-lista';

      const esV = p.correcta === true || String(p.correcta) === 'true';
      listaOpciones.innerHTML = `
        <li class="pregunta-opcion-item ${esV ? 'es-correcta' : ''}">
          <span class="pregunta-opcion-badge">${esV ? '✓' : '•'}</span> Verdadero
        </li>
        <li class="pregunta-opcion-item ${!esV ? 'es-correcta' : ''}">
          <span class="pregunta-opcion-badge">${!esV ? '✓' : '•'}</span> Falso
        </li>
      `;
      tarjeta.appendChild(listaOpciones);
    } else if (p.tipo === 'completar') {
      const bloqueCompletar = document.createElement('div');
      bloqueCompletar.className = 'pregunta-opcion-item es-correcta';
      bloqueCompletar.innerHTML = `
        <span class="pregunta-opcion-badge">✓</span>
        <span>Respuesta exacta esperada: <strong>${ui.escapar(p.correcta)}</strong></span>
      `;
      tarjeta.appendChild(bloqueCompletar);
    }

    // Retroalimentación formativa
    if (p.retroalimentacion && p.retroalimentacion.trim()) {
      const retro = document.createElement('div');
      retro.className = 'pregunta-retro';
      retro.innerHTML = `<strong>Retroalimentación:</strong> <span>${ui.escapar(p.retroalimentacion)}</span>`;
      tarjeta.appendChild(retro);
    }

    // Acciones de la pregunta (Editar / Eliminar)
    const acciones = document.createElement('div');
    acciones.className = 'pregunta-acciones';

    const btnEditar = document.createElement('button');
    btnEditar.type = 'button';
    btnEditar.className = 'btn btn--secundario btn--pequeno';
    btnEditar.textContent = 'Editar';
    btnEditar.addEventListener('click', () => abrirModalPregunta(p));
    acciones.appendChild(btnEditar);

    const btnEliminar = document.createElement('button');
    btnEliminar.type = 'button';
    btnEliminar.className = 'btn btn--peligro btn--pequeno';
    btnEliminar.textContent = 'Eliminar';
    btnEliminar.addEventListener('click', () => confirmarEliminarPregunta(p));
    acciones.appendChild(btnEliminar);

    tarjeta.appendChild(acciones);
    contenedor.appendChild(tarjeta);
  });
}

/**
 * Abre el modal de creación o edición de pregunta
 * @param {Object|null} [pregunta=null]
 */
function abrirModalPregunta(pregunta = null) {
  preguntaEnEdicion = pregunta;
  const modal = document.getElementById('modal-pregunta');
  const titulo = document.getElementById('titulo-modal-pregunta');
  const idInput = document.getElementById('pregunta-id');
  const tipoSelect = document.getElementById('pregunta-tipo');
  const nivelSelect = document.getElementById('pregunta-nivel');
  const enunciadoInput = document.getElementById('pregunta-enunciado');
  const retroInput = document.getElementById('pregunta-retro');
  const estadoSelect = document.getElementById('pregunta-estado');

  if (pregunta) {
    titulo.textContent = 'Editar pregunta';
    idInput.value = pregunta.id;
    tipoSelect.value = pregunta.tipo || 'opcion';
    nivelSelect.value = String(pregunta.nivel || nivelActivo);
    enunciadoInput.value = pregunta.enunciado || '';
    retroInput.value = pregunta.retroalimentacion || '';
    estadoSelect.value = pregunta.estado || 'aprobado';
  } else {
    titulo.textContent = 'Nueva pregunta';
    idInput.value = '';
    tipoSelect.value = 'opcion';
    nivelSelect.value = String(nivelActivo);
    enunciadoInput.value = '';
    retroInput.value = '';
    estadoSelect.value = 'aprobado';
  }

  renderizarSeccionRespuestas(tipoSelect.value, pregunta);
  modal.hidden = false;
  enunciadoInput.focus();
}

/**
 * Cierra el modal de pregunta
 */
function cerrarModalPregunta() {
  document.getElementById('modal-pregunta').hidden = true;
  preguntaEnEdicion = null;
}

/**
 * Renderiza los campos de respuesta dinámica según el tipo seleccionado
 * @param {string} tipo - 'opcion' | 'vf' | 'completar'
 * @param {Object|null} [datosExistentes=null]
 */
function renderizarSeccionRespuestas(tipo, datosExistentes = null) {
  const contenedor = document.getElementById('seccion-opciones');
  contenedor.innerHTML = '';

  if (tipo === 'opcion') {
    const etiqueta = document.createElement('label');
    etiqueta.className = 'campo__etiqueta';
    etiqueta.textContent = 'Opciones de respuesta (marca la opción correcta):';
    contenedor.appendChild(etiqueta);

    const opcionesIniciales = datosExistentes?.opciones?.length >= 2
      ? datosExistentes.opciones
      : ['', '', '', ''];
    const correctaIdx = Number(datosExistentes?.correcta) || 0;

    opcionesIniciales.forEach((opc, idx) => {
      const fila = document.createElement('div');
      fila.className = 'fila-opcion';

      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'opcion-correcta';
      radio.value = idx;
      radio.id = `radio-opc-${idx}`;
      if (idx === correctaIdx) radio.checked = true;

      const inputTexto = document.createElement('input');
      inputTexto.type = 'text';
      inputTexto.className = 'campo__control input-opcion-texto';
      inputTexto.placeholder = `Opción ${String.fromCharCode(65 + idx)}`;
      inputTexto.value = opc;
      inputTexto.required = true;

      fila.appendChild(radio);
      fila.appendChild(inputTexto);
      contenedor.appendChild(fila);
    });
  } else if (tipo === 'vf') {
    const etiqueta = document.createElement('label');
    etiqueta.className = 'campo__etiqueta';
    etiqueta.textContent = 'Respuesta correcta:';
    contenedor.appendChild(etiqueta);

    const esVerdadero = datosExistentes
      ? (datosExistentes.correcta === true || String(datosExistentes.correcta) === 'true')
      : true;

    const filaV = document.createElement('div');
    filaV.className = 'fila-opcion';
    filaV.innerHTML = `
      <input type="radio" name="vf-correcta" id="vf-verdadero" value="true" ${esVerdadero ? 'checked' : ''}>
      <label for="vf-verdadero">Verdadero</label>
    `;

    const filaF = document.createElement('div');
    filaF.className = 'fila-opcion';
    filaF.innerHTML = `
      <input type="radio" name="vf-correcta" id="vf-falso" value="false" ${!esVerdadero ? 'checked' : ''}>
      <label for="vf-falso">Falso</label>
    `;

    contenedor.appendChild(filaV);
    contenedor.appendChild(filaF);
  } else if (tipo === 'completar') {
    const etiqueta = document.createElement('label');
    etiqueta.htmlFor = 'completar-correcta';
    etiqueta.className = 'campo__etiqueta';
    etiqueta.textContent = 'Palabra o frase exacta esperada:';
    contenedor.appendChild(etiqueta);

    const inputCompletar = document.createElement('input');
    inputCompletar.type = 'text';
    inputCompletar.id = 'completar-correcta';
    inputCompletar.className = 'campo__control';
    inputCompletar.placeholder = 'Ej: arnés de seguridad';
    inputCompletar.required = true;
    inputCompletar.value = datosExistentes?.correcta || '';

    contenedor.appendChild(inputCompletar);
  }
}

/**
 * Guarda los datos de la pregunta (creación o actualización)
 */
async function guardarPregunta() {
  if (!temaActualId) {
    ui.aviso('Debes seleccionar un tema primero', 'error');
    return;
  }

  const id = document.getElementById('pregunta-id').value;
  const tipo = document.getElementById('pregunta-tipo').value;
  const nivel = Number(document.getElementById('pregunta-nivel').value);
  const enunciado = document.getElementById('pregunta-enunciado').value.trim();
  const retroalimentacion = document.getElementById('pregunta-retro').value.trim();
  const estado = document.getElementById('pregunta-estado').value;

  if (!enunciado) {
    ui.aviso('El enunciado es obligatorio', 'error');
    return;
  }

  let opciones = [];
  let correcta = null;

  if (tipo === 'opcion') {
    const inputsTexto = Array.from(document.querySelectorAll('.input-opcion-texto'));
    opciones = inputsTexto.map((inp) => inp.value.trim()).filter((t) => t.length > 0);

    if (opciones.length < 2) {
      ui.aviso('Debes proporcionar al menos 2 opciones de respuesta', 'error');
      return;
    }

    const radioChecked = document.querySelector('input[name="opcion-correcta"]:checked');
    correcta = radioChecked ? Number(radioChecked.value) : 0;
    if (correcta >= opciones.length) correcta = 0;
  } else if (tipo === 'vf') {
    opciones = ['Verdadero', 'Falso'];
    const radioVf = document.querySelector('input[name="vf-correcta"]:checked');
    correcta = radioVf?.value === 'true';
  } else if (tipo === 'completar') {
    opciones = [];
    correcta = document.getElementById('completar-correcta')?.value.trim();
    if (!correcta) {
      ui.aviso('La respuesta para completar es obligatoria', 'error');
      return;
    }
  }

  const datosPregunta = {
    temaId: temaActualId,
    nivel,
    tipo,
    enunciado,
    opciones,
    correcta,
    retroalimentacion,
    estado,
    origen: id && preguntaEnEdicion ? preguntaEnEdicion.origen : 'docente'
  };

  try {
    ui.cargando(true);
    if (id) {
      await api.actualizar('preguntas', id, datosPregunta);
      ui.aviso('Pregunta actualizada con éxito', 'exito');
    } else {
      await api.crear('preguntas', datosPregunta);
      ui.aviso('Pregunta creada con éxito', 'exito');
    }

    cerrarModalPregunta();
    await cargarPreguntasTema();
  } catch (err) {
    ui.aviso(`Error al guardar: ${err.message}`, 'error');
  } finally {
    ui.cargando(false);
  }
}

/**
 * Solicita confirmación y elimina una pregunta
 * @param {Object} pregunta
 */
async function confirmarEliminarPregunta(pregunta) {
  const aceptado = await ui.confirmar(`¿Estás seguro de que deseas eliminar esta pregunta del Nivel ${pregunta.nivel}?`);
  if (!aceptado) return;

  try {
    ui.cargando(true);
    await api.eliminar('preguntas', pregunta.id);
    ui.aviso('Pregunta eliminada con éxito', 'exito');
    await cargarPreguntasTema();
  } catch (err) {
    ui.aviso(`Error al eliminar: ${err.message}`, 'error');
  } finally {
    ui.cargando(false);
  }
}

// --- GENERACIÓN CON IA ---

/**
 * Abre el diálogo modal de generación con IA
 */
function abrirModalIa() {
  if (!temaActualId) {
    ui.aviso('Debes seleccionar un tema primero', 'error');
    return;
  }

  const modal = document.getElementById('modal-ia');
  document.getElementById('ia-paso-config').hidden = false;
  document.getElementById('ia-cargando').hidden = true;
  document.getElementById('ia-paso-revision').hidden = true;

  document.getElementById('ia-nivel').value = String(nivelActivo);
  document.getElementById('ia-cantidad').value = '5';
  propuestasIa = [];

  modal.hidden = false;
}

/**
 * Cierra el diálogo modal de generación con IA
 */
function cerrarModalIa() {
  document.getElementById('modal-ia').hidden = true;
}

/**
 * Ejecuta la tarea de IA generar-preguntas
 */
async function ejecutarGeneracionIa() {
  const nivel = Number(document.getElementById('ia-nivel').value);
  const cantidad = Number(document.getElementById('ia-cantidad').value);

  if (cantidad < 5 || cantidad > 15) {
    ui.aviso('La cantidad debe estar entre 5 y 15', 'error');
    return;
  }

  document.getElementById('ia-paso-config').hidden = true;
  document.getElementById('ia-cargando').hidden = false;

  try {
    const resultado = await api.ia('generar-preguntas', {
      temaId: temaActualId,
      nivel,
      cantidad
    });

    propuestasIa = Array.isArray(resultado) ? resultado : [];

    if (propuestasIa.length === 0) {
      ui.aviso('No se recibieron propuestas de preguntas', 'info');
      cerrarModalIa();
      return;
    }

    // Asociar nivel solicitado a cada propuesta
    propuestasIa.forEach((p) => {
      p.nivel = nivel;
      p.temaId = temaActualId;
    });

    document.getElementById('ia-cargando').hidden = true;
    document.getElementById('ia-paso-revision').hidden = false;

    renderizarPropuestasIa();
  } catch (err) {
    ui.aviso(`Error en generación con IA: ${err.message}`, 'error');
    document.getElementById('ia-cargando').hidden = true;
    document.getElementById('ia-paso-config').hidden = false;
  }
}

/**
 * Renderiza la lista de propuestas generadas por IA para su aprobación
 */
function renderizarPropuestasIa() {
  const contenedor = document.getElementById('contenedor-propuestas-ia');
  contenedor.innerHTML = '';

  if (propuestasIa.length === 0) {
    contenedor.innerHTML = '<p class="banco-texto-ayuda">Todas las propuestas han sido procesadas.</p>';
    document.getElementById('btn-aprobar-todas-ia').disabled = true;
    return;
  }

  document.getElementById('btn-aprobar-todas-ia').disabled = false;

  propuestasIa.forEach((prop, index) => {
    const tarjeta = document.createElement('article');
    tarjeta.className = 'propuesta-tarjeta';

    const header = document.createElement('div');
    header.className = 'pregunta-cabecera';
    header.innerHTML = `
      <span class="chip-tipo">${prop.tipo}</span>
      <span class="chip-origen">Propuesta ${index + 1}</span>
    `;
    tarjeta.appendChild(header);

    const texto = document.createElement('div');
    texto.className = 'pregunta-enunciado';
    texto.textContent = prop.enunciado;
    tarjeta.appendChild(texto);

    // Opciones
    if (prop.tipo === 'opcion' && Array.isArray(prop.opciones)) {
      const lista = document.createElement('ul');
      lista.className = 'pregunta-opciones-lista';
      prop.opciones.forEach((opc, i) => {
        const item = document.createElement('li');
        const esC = Number(prop.correcta) === i;
        item.className = `pregunta-opcion-item ${esC ? 'es-correcta' : ''}`;
        item.innerHTML = `<span class="pregunta-opcion-badge">${esC ? '✓' : '•'}</span> ${ui.escapar(opc)}`;
        lista.appendChild(item);
      });
      tarjeta.appendChild(lista);
    } else if (prop.tipo === 'vf') {
      const lista = document.createElement('div');
      lista.className = 'pregunta-opcion-item es-correcta';
      lista.innerHTML = `<span>Respuesta correcta: <strong>${prop.correcta ? 'Verdadero' : 'Falso'}</strong></span>`;
      tarjeta.appendChild(lista);
    } else if (prop.tipo === 'completar') {
      const bloque = document.createElement('div');
      bloque.className = 'pregunta-opcion-item es-correcta';
      bloque.innerHTML = `<span>Respuesta esperada: <strong>${ui.escapar(prop.correcta)}</strong></span>`;
      tarjeta.appendChild(bloque);
    }

    if (prop.retroalimentacion) {
      const retro = document.createElement('div');
      retro.className = 'pregunta-retro';
      retro.innerHTML = `<strong>Retroalimentación:</strong> ${ui.escapar(prop.retroalimentacion)}`;
      tarjeta.appendChild(retro);
    }

    // Botones de acción: Aprobar, Editar, Descartar
    const acciones = document.createElement('div');
    acciones.className = 'propuesta-acciones';

    const btnAprobar = document.createElement('button');
    btnAprobar.type = 'button';
    btnAprobar.className = 'btn btn--primario btn--pequeno';
    btnAprobar.innerHTML = '✓ Aprobar';
    btnAprobar.addEventListener('click', () => aprobarPropuestaIndividual(index));
    acciones.appendChild(btnAprobar);

    const btnEditar = document.createElement('button');
    btnEditar.type = 'button';
    btnEditar.className = 'btn btn--secundario btn--pequeno';
    btnEditar.innerHTML = '✎ Editar';
    btnEditar.addEventListener('click', () => editarPropuestaIa(index));
    acciones.appendChild(btnEditar);

    const btnDescartar = document.createElement('button');
    btnDescartar.type = 'button';
    btnDescartar.className = 'btn btn--peligro btn--pequeno';
    btnDescartar.innerHTML = '✕ Descartar';
    btnDescartar.addEventListener('click', () => descartarPropuestaIa(index));
    acciones.appendChild(btnDescartar);

    tarjeta.appendChild(acciones);
    contenedor.appendChild(tarjeta);
  });
}

/**
 * Aprueba una propuesta de IA guardándola en la base de preguntas con origen: 'ia' y estado: 'aprobado'
 * @param {number} index
 */
async function aprobarPropuestaIndividual(index) {
  const prop = propuestasIa[index];
  if (!prop) return;

  const datosGuardar = {
    temaId: temaActualId,
    nivel: Number(prop.nivel || nivelActivo),
    tipo: prop.tipo,
    enunciado: prop.enunciado,
    opciones: prop.opciones || [],
    correcta: prop.correcta,
    retroalimentacion: prop.retroalimentacion || '',
    origen: 'ia',
    estado: 'aprobado'
  };

  try {
    ui.cargando(true);
    await api.crear('preguntas', datosGuardar);
    ui.aviso('Pregunta de IA aprobada y guardada en el banco', 'exito');

    // Quitar de la lista de propuestas
    propuestasIa.splice(index, 1);
    renderizarPropuestasIa();
    await cargarPreguntasTema();
  } catch (err) {
    ui.aviso(`Error al aprobar propuesta: ${err.message}`, 'error');
  } finally {
    ui.cargando(false);
  }
}

/**
 * Abre el editor manual con los datos de la propuesta para afinarla antes de guardar
 * @param {number} index
 */
function editarPropuestaIa(index) {
  const prop = propuestasIa[index];
  if (!prop) return;

  // Quitar de propuestas
  propuestasIa.splice(index, 1);
  renderizarPropuestasIa();

  abrirModalPregunta({
    ...prop,
    origen: 'ia',
    estado: 'aprobado'
  });
}

/**
 * Descarta una propuesta generada por IA
 * @param {number} index
 */
function descartarPropuestaIa(index) {
  propuestasIa.splice(index, 1);
  ui.aviso('Propuesta descartada', 'info');
  renderizarPropuestasIa();
}

/**
 * Aprueba en lote todas las propuestas restantes de IA
 */
async function aprobarTodasPropuestasIa() {
  if (propuestasIa.length === 0) return;

  try {
    ui.cargando(true);
    let aprobadas = 0;

    for (const prop of [...propuestasIa]) {
      const datosGuardar = {
        temaId: temaActualId,
        nivel: Number(prop.nivel || nivelActivo),
        tipo: prop.tipo,
        enunciado: prop.enunciado,
        opciones: prop.opciones || [],
        correcta: prop.correcta,
        retroalimentacion: prop.retroalimentacion || '',
        origen: 'ia',
        estado: 'aprobado'
      };
      await api.crear('preguntas', datosGuardar);
      aprobadas++;
    }

    propuestasIa = [];
    ui.aviso(`Se aprobaron y guardaron ${aprobadas} preguntas con éxito`, 'exito');
    renderizarPropuestasIa();
    await cargarPreguntasTema();
    cerrarModalIa();
  } catch (err) {
    ui.aviso(`Error al aprobar propuestas en lote: ${err.message}`, 'error');
  } finally {
    ui.cargando(false);
  }
}

// --- GESTIÓN DE CONFIGURACIÓN DE IA (ADMIN) ---

/**
 * Abre el modal de configuración de IA cargando los valores vigentes del servidor
 */
async function abrirModalConfigIa() {
  const modal = document.getElementById('modal-config-ia');
  const inputClave = document.getElementById('cfg-ia-clave');
  const inputModelo = document.getElementById('cfg-ia-modelo');
  const ayudaClave = document.getElementById('ayuda-clave-actual');
  const boxResultado = document.getElementById('resultado-prueba-ia');

  boxResultado.hidden = true;
  modal.hidden = false;

  try {
    ui.cargando(true);
    const datosConfig = await api.llamar('GET', '/api/ia/config');
    inputClave.value = datosConfig.claveIa || '';
    inputModelo.value = datosConfig.modelo || 'gemini-3.8-flash';

    if (datosConfig.claveEnmascarada) {
      ayudaClave.innerHTML = `Clave activa: <strong>${ui.escapar(datosConfig.claveEnmascarada)}</strong>.`;
    } else {
      ayudaClave.textContent = 'Sin clave configurada (se usará respaldo formativo local).';
    }
  } catch (err) {
    ui.aviso(`Error al consultar configuración de IA: ${err.message}`, 'error');
  } finally {
    ui.cargando(false);
  }
}

/**
 * Cierra el modal de configuración de IA
 */
function cerrarModalConfigIa() {
  document.getElementById('modal-config-ia').hidden = true;
}

/**
 * Alterna visibilidad del input de contraseña de la clave
 */
function toggleVisibilidadClave() {
  const input = document.getElementById('cfg-ia-clave');
  input.type = input.type === 'password' ? 'text' : 'password';
}

/**
 * Guarda la configuración de IA mediante la API
 */
async function guardarConfigIa() {
  const claveIa = document.getElementById('cfg-ia-clave').value.trim();
  const modelo = document.getElementById('cfg-ia-modelo').value.trim() || 'gemini-3.8-flash';

  try {
    ui.cargando(true);
    const res = await api.llamar('PUT', '/api/ia/config', {
      claveIa,
      modelo,
      proveedor: 'gemini'
    });

    ui.aviso(res.mensaje || 'Configuración de IA guardada con éxito', 'exito');
    cerrarModalConfigIa();
  } catch (err) {
    ui.aviso(`Error al guardar configuración: ${err.message}`, 'error');
  } finally {
    ui.cargando(false);
  }
}

/**
 * Prueba la conectividad con la API de Google Gemini en vivo
 */
async function probarConexionIa() {
  const claveIa = document.getElementById('cfg-ia-clave').value.trim();
  const modelo = document.getElementById('cfg-ia-modelo').value.trim() || 'gemini-3.8-flash';

  const boxResultado = document.getElementById('resultado-prueba-ia');
  const iconoResultado = document.getElementById('icono-prueba-ia');
  const mensajeResultado = document.getElementById('mensaje-prueba-ia');

  boxResultado.hidden = false;
  boxResultado.style.backgroundColor = 'var(--color-info-fondo)';
  boxResultado.style.borderLeftColor = 'var(--color-info)';
  iconoResultado.textContent = '⏳';
  mensajeResultado.textContent = `Probando conexión con Google Gemini (${modelo})...`;

  try {
    const res = await api.llamar('POST', '/api/ia/probar-conexion', { claveIa, modelo });

    if (res.ok) {
      boxResultado.style.backgroundColor = 'var(--color-exito-fondo)';
      boxResultado.style.borderLeftColor = 'var(--color-exito)';
      iconoResultado.textContent = '✅';
      mensajeResultado.innerHTML = `<strong>Éxito:</strong> ${ui.escapar(res.mensaje)}`;
    } else {
      boxResultado.style.backgroundColor = 'var(--color-error-fondo)';
      boxResultado.style.borderLeftColor = 'var(--color-error)';
      iconoResultado.textContent = '❌';
      mensajeResultado.innerHTML = `<strong>Fallo de conexión:</strong> ${ui.escapar(res.mensaje)}`;
    }
  } catch (err) {
    boxResultado.style.backgroundColor = 'var(--color-error-fondo)';
    boxResultado.style.borderLeftColor = 'var(--color-error)';
    iconoResultado.textContent = '❌';
    mensajeResultado.innerHTML = `<strong>Error de solicitud:</strong> ${ui.escapar(err.message)}`;
  }
}

// Iniciar al cargar el script
iniciar();
