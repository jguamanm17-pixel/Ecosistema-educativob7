// publico/js/modulos/quiz.js · Actividad interactiva del quiz por niveles y diplomas
import { montarPlantilla } from '../nucleo/plantilla.js';
import { obtenerTemaActividad } from '../nucleo/selector-tema.js';
import { mostrarRetro, mostrarResumen } from '../nucleo/retroalimentacion.js';
import { mostrarLogros } from '../nucleo/gamificacion.js';
import { generarDiploma } from '../nucleo/pdf.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';

const NOMBRES_BLOOM = {
  1: 'Recordar',
  2: 'Comprender',
  3: 'Aplicar',
  4: 'Analizar',
  5: 'Evaluar'
};

// Estado global de la página
let temaActual = null;
let nivelesEstado = [];
let sesionActual = null;
let respuestaSeleccionada = null;

/**
 * Inicialización de la página
 */
async function iniciar() {
  await montarPlantilla({ titulo: 'Quiz por niveles', roles: ['estudiante'] });

  conectarEventosGenerales();

  try {
    temaActual = await obtenerTemaActividad();
    actualizarEncabezadoTema();
    await cargarEstadoNiveles();
  } catch (err) {
    ui.aviso(`Error al iniciar la actividad: ${err.message}`, 'error');
  }
}

/**
 * Conecta los escuchadores de eventos principales
 */
function conectarEventosGenerales() {
  document.getElementById('btn-cambiar-tema').addEventListener('click', async () => {
    try {
      temaActual = await obtenerTemaActividad();
      actualizarEncabezadoTema();
      await cargarEstadoNiveles();
    } catch (err) {
      ui.aviso(`No se pudo cambiar de tema: ${err.message}`, 'info');
    }
  });

  document.getElementById('btn-abandonar-quiz').addEventListener('click', async () => {
    const salir = await ui.confirmar('¿Estás seguro de que deseas abandonar la evaluación? El progreso de este intento no se guardará.');
    if (salir) {
      volverANiveles();
    }
  });

  document.getElementById('btn-responder-pregunta').addEventListener('click', () => {
    enviarRespuestaActual();
  });

  document.getElementById('btn-volver-niveles').addEventListener('click', () => {
    volverANiveles();
  });

  document.getElementById('btn-reintentar-quiz').addEventListener('click', () => {
    if (sesionActual && sesionActual.nivel) {
      iniciarNivelQuiz(sesionActual.nivel);
    }
  });

  document.getElementById('btn-descargar-diploma').addEventListener('click', async () => {
    if (sesionActual && sesionActual.nivel) {
      await generarDiploma({
        tipo: 'nivel-quiz',
        temaId: temaActual.id,
        nivel: sesionActual.nivel
      });
    }
  });
}

/**
 * Actualiza el texto del tema seleccionado en el encabezado
 */
function actualizarEncabezadoTema() {
  const el = document.getElementById('etiqueta-tema-titulo');
  if (el && temaActual) {
    el.textContent = temaActual.titulo;
  }
}

/**
 * Consulta el estado de los 5 niveles taxonómicos para el tema actual
 */
async function cargarEstadoNiveles() {
  if (!temaActual) return;

  ui.cargando(true);
  try {
    const data = await api.llamar('GET', `/api/quiz/estado?temaId=${temaActual.id}`);
    nivelesEstado = Array.isArray(data.niveles) ? data.niveles : [];
    renderizarTableroNiveles();
  } catch (err) {
    ui.aviso(`Error al consultar niveles: ${err.message}`, 'error');
  } finally {
    ui.cargando(false);
  }
}

/**
 * Renderiza las 5 tarjetas de nivel en el tablero
 */
function renderizarTableroNiveles() {
  const grid = document.getElementById('grid-niveles');
  grid.innerHTML = '';

  nivelesEstado.forEach((n) => {
    const card = document.createElement('article');
    const esBloqueado = n.estado === 'bloqueado';
    const esAprobado = n.estado === 'aprobado';
    const esDisponible = n.estado === 'disponible';

    card.className = `nivel-card ${esBloqueado ? 'bloqueado' : ''}`;

    // Cabecera de tarjeta
    const cabecera = document.createElement('div');
    cabecera.className = 'nivel-card-header';

    const titulos = document.createElement('div');
    titulos.innerHTML = `
      <span class="nivel-card-bloom">Taxonomía de Bloom</span>
      <h3 class="nivel-card-titulo">Nivel ${n.nivel} · ${n.nombre}</h3>
    `;
    cabecera.appendChild(titulos);

    const chipEstado = document.createElement('span');
    chipEstado.className = `nivel-estado-chip ${n.estado}`;
    chipEstado.textContent = esAprobado ? '✓ Aprobado' : (esDisponible ? 'Disponible' : '🔒 Bloqueado');
    cabecera.appendChild(chipEstado);

    card.appendChild(cabecera);

    // Métricas (mejor porcentaje)
    const metricas = document.createElement('div');
    metricas.className = 'nivel-card-metricas';
    metricas.innerHTML = `
      <span>Mejor calificación:</span>
      <strong>${n.mejorPorcentaje > 0 ? `${n.mejorPorcentaje}%` : 'Sin intentos'}</strong>
    `;
    card.appendChild(metricas);

    // Acciones de la tarjeta
    const acciones = document.createElement('div');
    acciones.className = 'nivel-card-acciones';

    if (esDisponible || esAprobado) {
      const btnIniciar = document.createElement('button');
      btnIniciar.type = 'button';
      btnIniciar.className = `btn ${esAprobado ? 'btn--secundario' : 'btn--primario'}`;
      btnIniciar.textContent = esAprobado ? 'Repetir para mejorar puntaje' : 'Iniciar evaluación';
      btnIniciar.addEventListener('click', () => iniciarNivelQuiz(n.nivel));
      acciones.appendChild(btnIniciar);

      if (esAprobado) {
        const btnDiploma = document.createElement('button');
        btnDiploma.type = 'button';
        btnDiploma.className = 'btn btn--texto btn--pequeno';
        btnDiploma.innerHTML = '📜 Descargar diploma de nivel';
        btnDiploma.addEventListener('click', async () => {
          await generarDiploma({
            tipo: 'nivel-quiz',
            temaId: temaActual.id,
            nivel: n.nivel
          });
        });
        acciones.appendChild(btnDiploma);
      }
    } else {
      const pBloqueo = document.createElement('p');
      pBloqueo.style.fontSize = 'var(--tamano-xs)';
      pBloqueo.style.color = 'var(--color-texto-suave)';
      pBloqueo.style.marginBottom = '0';
      pBloqueo.textContent = `Aprueba el Nivel ${n.nivel - 1} para desbloquear esta evaluación.`;
      acciones.appendChild(pBloqueo);
    }

    card.appendChild(acciones);
    grid.appendChild(card);
  });
}

/**
 * Inicia una sesión de quiz para el nivel seleccionado
 * @param {number} nivel
 */
async function iniciarNivelQuiz(nivel) {
  if (!temaActual) return;

  ui.cargando(true);
  try {
    const data = await api.llamar('POST', '/api/quiz/iniciar', {
      temaId: temaActual.id,
      nivel
    });

    sesionActual = {
      id: data.sesionId,
      nivel,
      preguntas: Array.isArray(data.preguntas) ? data.preguntas : [],
      indicePregunta: 0
    };

    if (sesionActual.preguntas.length === 0) {
      throw new Error('No hay preguntas disponibles para este nivel.');
    }

    // Cambiar a la vista de sesión
    document.getElementById('vista-niveles').hidden = true;
    document.getElementById('vista-resultado').hidden = true;
    document.getElementById('vista-sesion').hidden = false;

    mostrarPreguntaActual();
  } catch (err) {
    ui.aviso(`Error al iniciar quiz: ${err.message}`, 'error');
  } finally {
    ui.cargando(false);
  }
}

/**
 * Muestra la pregunta actual según el índice de la sesión
 */
function mostrarPreguntaActual() {
  if (!sesionActual || sesionActual.indicePregunta >= sesionActual.preguntas.length) {
    finalizarSesionQuiz();
    return;
  }

  const { preguntas, indicePregunta, nivel } = sesionActual;
  const total = preguntas.length;
  const preg = preguntas[indicePregunta];

  // Actualizar metadatos y barra de progreso
  const pct = Math.round((indicePregunta / total) * 100);
  document.getElementById('barra-progreso-llenado').style.width = `${pct}%`;
  document.getElementById('barra-progreso-contenedor').setAttribute('aria-valuenow', pct);

  document.getElementById('sesion-contador-preguntas').textContent = `Pregunta ${indicePregunta + 1} de ${total}`;
  document.getElementById('sesion-nivel-etiqueta').textContent = `Nivel ${nivel} · ${NOMBRES_BLOOM[nivel]}`;

  document.getElementById('pregunta-enunciado').textContent = preg.enunciado;

  // Restablecer botón de respuesta
  const btnResponder = document.getElementById('btn-responder-pregunta');
  btnResponder.disabled = true;
  respuestaSeleccionada = null;

  // Renderizar opciones de respuesta según el tipo
  const contenedor = document.getElementById('contenedor-respuestas');
  contenedor.innerHTML = '';

  if (preg.tipo === 'opcion') {
    renderizarOpcionesMultiple(preg, contenedor);
  } else if (preg.tipo === 'vf') {
    renderizarOpcionesVF(contenedor);
  } else if (preg.tipo === 'completar') {
    renderizarOpcionCompletar(contenedor);
  }
}

/**
 * Renderiza las opciones de opción múltiple con botones de radio grandes y accesibles
 */
function renderizarOpcionesMultiple(pregunta, contenedor) {
  const listaOpciones = Array.isArray(pregunta.opciones) ? pregunta.opciones : [];

  listaOpciones.forEach((textoOpcion, index) => {
    const card = document.createElement('label');
    card.className = 'opcion-radio-card';

    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'opcion-quiz';
    radio.value = index;

    const letraBadge = document.createElement('span');
    letraBadge.className = 'opcion-letra-badge';
    letraBadge.textContent = String.fromCharCode(65 + index);

    const spanTexto = document.createElement('span');
    spanTexto.textContent = textoOpcion;

    card.appendChild(radio);
    card.appendChild(letraBadge);
    card.appendChild(spanTexto);

    card.addEventListener('click', () => {
      document.querySelectorAll('.opcion-radio-card').forEach((c) => c.classList.remove('seleccionada'));
      card.classList.add('seleccionada');
      radio.checked = true;
      respuestaSeleccionada = index;
      document.getElementById('btn-responder-pregunta').disabled = false;
    });

    contenedor.appendChild(card);
  });
}

/**
 * Renderiza las dos opciones de Verdadero / Falso como botones grandes
 */
function renderizarOpcionesVF(contenedor) {
  const gridVF = document.createElement('div');
  gridVF.className = 'grid-opciones-vf';

  const btnV = document.createElement('button');
  btnV.type = 'button';
  btnV.className = 'btn-opcion-vf';
  btnV.innerHTML = '<span>Verdadero</span><span style="font-size: var(--tamano-s); color: var(--color-exito);">✓</span>';

  const btnF = document.createElement('button');
  btnF.type = 'button';
  btnF.className = 'btn-opcion-vf';
  btnF.innerHTML = '<span>Falso</span><span style="font-size: var(--tamano-s); color: var(--color-error);">✕</span>';

  btnV.addEventListener('click', () => {
    btnV.classList.add('seleccionado');
    btnF.classList.remove('seleccionado');
    respuestaSeleccionada = true;
    document.getElementById('btn-responder-pregunta').disabled = false;
  });

  btnF.addEventListener('click', () => {
    btnF.classList.add('seleccionado');
    btnV.classList.remove('seleccionado');
    respuestaSeleccionada = false;
    document.getElementById('btn-responder-pregunta').disabled = false;
  });

  gridVF.appendChild(btnV);
  gridVF.appendChild(btnF);
  contenedor.appendChild(gridVF);
}

/**
 * Renderiza el campo de texto amplio para preguntas de completar
 */
function renderizarOpcionCompletar(contenedor) {
  const caja = document.createElement('div');
  caja.className = 'caja-completar';

  const label = document.createElement('label');
  label.htmlFor = 'input-completar';
  label.className = 'campo__etiqueta';
  label.textContent = 'Escribe la palabra o término exacto que completa el enunciado:';

  const input = document.createElement('input');
  input.type = 'text';
  input.id = 'input-completar';
  input.className = 'campo__control input-completar-quiz';
  input.placeholder = 'Escribe tu respuesta aquí...';
  input.autocomplete = 'off';

  input.addEventListener('input', () => {
    const val = input.value.trim();
    if (val.length > 0) {
      respuestaSeleccionada = val;
      document.getElementById('btn-responder-pregunta').disabled = false;
    } else {
      respuestaSeleccionada = null;
      document.getElementById('btn-responder-pregunta').disabled = true;
    }
  });

  caja.appendChild(label);
  caja.appendChild(input);
  contenedor.appendChild(caja);

  setTimeout(() => input.focus(), 100);
}

/**
 * Envía la respuesta de la pregunta actual y muestra la retroalimentación
 */
async function enviarRespuestaActual() {
  if (!sesionActual || respuestaSeleccionada === null) return;

  const { preguntas, indicePregunta } = sesionActual;
  const preg = preguntas[indicePregunta];

  ui.cargando(true);
  try {
    const res = await api.llamar('POST', '/api/quiz/responder', {
      sesionId: sesionActual.id,
      preguntaId: preg.id,
      respuesta: respuestaSeleccionada
    });

    ui.cargando(false);

    // Mostrar modal formativo de retroalimentación
    await mostrarRetro({
      correcto: res.correcto,
      explicacion: res.retroalimentacion,
      sugerencia: res.correcto ? null : `Respuesta esperada: ${res.correcta}`,
      enlaceTema: `/paginas/tema.html?id=${temaActual.id}`
    });

    // Pasar a la siguiente pregunta
    sesionActual.indicePregunta++;
    mostrarPreguntaActual();
  } catch (err) {
    ui.cargando(false);
    ui.aviso(`Error al enviar respuesta: ${err.message}`, 'error');
  }
}

/**
 * Finaliza la sesión de quiz, calcula resultados, muestra logros y resumen
 */
async function finalizarSesionQuiz() {
  if (!sesionActual) return;

  ui.cargando(true);
  try {
    const resFinal = await api.llamar('POST', '/api/quiz/finalizar', {
      sesionId: sesionActual.id
    });

    ui.cargando(false);

    // 1. Mostrar resumen formativo
    await mostrarResumen({
      titulo: resFinal.aprobado
        ? `¡Felicitaciones! Nivel ${sesionActual.nivel} Aprobado`
        : `Nivel ${sesionActual.nivel} no superado`,
      aciertos: resFinal.aciertos,
      errores: resFinal.total - resFinal.aciertos,
      recomendaciones: resFinal.repasar,
      enlaceTema: `/paginas/tema.html?id=${temaActual.id}`
    });

    // 2. Si aprobó, mostrar recompensas de gamificación
    if (resFinal.aprobado) {
      mostrarLogros({
        puntosGanados: resFinal.puntosGanados,
        insigniasNuevas: resFinal.insigniasNuevas
      });
    }

    // 3. Renderizar la vista de resultado final
    mostrarPantallaResultado(resFinal);
  } catch (err) {
    ui.cargando(false);
    ui.aviso(`Error al finalizar sesión de quiz: ${err.message}`, 'error');
    volverANiveles();
  }
}

/**
 * Muestra la pantalla de resultados finales con opciones de diploma y reintento
 */
function mostrarPantallaResultado(resultado) {
  document.getElementById('vista-sesion').hidden = true;
  document.getElementById('vista-niveles').hidden = true;
  document.getElementById('vista-resultado').hidden = false;

  const iconoEstado = document.getElementById('resultado-icono-estado');
  const titulo = document.getElementById('resultado-titulo');
  const descripcion = document.getElementById('resultado-descripcion');
  const btnDiploma = document.getElementById('btn-descargar-diploma');
  const cajaGamif = document.getElementById('resultado-gamificacion');
  const textoPuntos = document.getElementById('resultado-puntos-texto');
  const bloqueRepaso = document.getElementById('resultado-bloque-repaso');
  const listaRepaso = document.getElementById('resultado-lista-repaso');

  document.getElementById('metrica-aciertos').textContent = resultado.aciertos;
  document.getElementById('metrica-errores').textContent = resultado.total - resultado.aciertos;
  document.getElementById('metrica-porcentaje').textContent = `${resultado.porcentaje}%`;

  if (resultado.aprobado) {
    iconoEstado.textContent = '🏆';
    titulo.textContent = `¡Nivel ${sesionActual.nivel} Aprobado!`;
    descripcion.textContent = `Has superado con éxito el nivel taxonómico de ${NOMBRES_BLOOM[sesionActual.nivel]}.`;
    btnDiploma.hidden = false;
  } else {
    iconoEstado.textContent = '💡';
    titulo.textContent = `Nivel ${sesionActual.nivel} no alcanzado`;
    descripcion.textContent = `Necesitas al menos 70% de aprobación para avanzar y desbloquear tu diploma.`;
    btnDiploma.hidden = true;
  }

  if (resultado.puntosGanados > 0) {
    cajaGamif.hidden = false;
    textoPuntos.textContent = `¡Has obtenido +${resultado.puntosGanados} puntos de experiencia!`;
  } else {
    cajaGamif.hidden = true;
  }

  if (Array.isArray(resultado.repasar) && resultado.repasar.length > 0) {
    bloqueRepaso.hidden = false;
    listaRepaso.innerHTML = '';
    resultado.repasar.forEach((txt) => {
      const li = document.createElement('li');
      li.textContent = txt;
      listaRepaso.appendChild(li);
    });
  } else {
    bloqueRepaso.hidden = true;
  }
}

/**
 * Vuelve al tablero general de niveles
 */
async function volverANiveles() {
  sesionActual = null;
  document.getElementById('vista-sesion').hidden = true;
  document.getElementById('vista-resultado').hidden = true;
  document.getElementById('vista-niveles').hidden = false;

  await cargarEstadoNiveles();
}

iniciar();
