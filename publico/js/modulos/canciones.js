// publico/js/modulos/canciones.js · Reproductor y catálogo de canciones educativas
import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import { usuarioActual } from '../nucleo/sesion.js';
import { aviso, cargando, escapar } from '../nucleo/ui.js';
import { parametro } from '../nucleo/util.js';

await montarPlantilla({ titulo: 'Canciones', roles: ['sesion'] });

const usuario = usuarioActual();
const esDocenteOAdmin = usuario && (usuario.rol === 'docente' || usuario.rol === 'admin');
const temaIdParam = parametro('temaId');

const bloqueAccionDocente = document.getElementById('bloque-accion-docente');
const filtroAsignatura = document.getElementById('filtro-asignatura');
const filtroTema = document.getElementById('filtro-tema');
const contadorCanciones = document.getElementById('contador-canciones');
const contenedorLista = document.getElementById('contenedor-canciones-lista');

// Elementos del reproductor
const estadoVacio = document.getElementById('estado-reproductor-vacio');
const cuerpoReproductor = document.getElementById('cuerpo-reproductor');
const cancionTemaEtiqueta = document.getElementById('cancion-tema-etiqueta');
const cancionTitulo = document.getElementById('cancion-titulo');
const cancionAutoria = document.getElementById('cancion-autoria');
const cancionLicencia = document.getElementById('cancion-licencia');
const bloqueEditarCancion = document.getElementById('bloque-editar-cancion-activa');
const enlaceEditarCancion = document.getElementById('enlace-editar-cancion-activa');

const audio = document.getElementById('audio-elemento');
const btnReproducir = document.getElementById('btn-reproducir');
const iconoPlay = document.getElementById('icono-play');
const btnReiniciar = document.getElementById('btn-reiniciar');
const tiempoActual = document.getElementById('tiempo-actual');
const tiempoTotal = document.getElementById('tiempo-total');
const barraProgreso = document.getElementById('barra-progreso');
const btnSilenciar = document.getElementById('btn-silenciar');
const iconoVolumen = document.getElementById('icono-volumen');
const barraVolumen = document.getElementById('barra-volumen');

const indicadorLrc = document.getElementById('indicador-lrc');
const contenedorLetras = document.getElementById('contenedor-letras');

if (esDocenteOAdmin && bloqueAccionDocente) {
  bloqueAccionDocente.style.display = 'block';
}

let todasCanciones = [];
let todasAsignaturas = [];
let todasUnidades = [];
let todosTemas = [];

let mapaAsignaturas = new Map();
let mapaUnidades = new Map();
let mapaTemas = new Map();
let mapaTemaAsignatura = new Map();

let cancionActiva = null;
let lineasLrcParseadas = [];
let indiceLineaActiva = -1;
let elementosLineasDom = [];

// Formatea segundos en formato "mm:ss"
function formatearTiempo(segundos) {
  if (isNaN(segundos) || segundos < 0) return '00:00';
  const m = Math.floor(segundos / 60);
  const s = Math.floor(segundos % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// Analiza y parsea texto LRC con formato [mm:ss.xx]
function parsearLRC(lrcTexto) {
  if (!lrcTexto || typeof lrcTexto !== 'string') return [];
  const lineas = lrcTexto.split('\n');
  const resultado = [];
  const regex = /\[(\d{1,2}):(\d{2}(?:\.\d{1,3})?)\](.*)/;

  for (const l of lineas) {
    const match = l.match(regex);
    if (match) {
      const min = parseInt(match[1], 10);
      const seg = parseFloat(match[2]);
      const tiempo = min * 60 + seg;
      const texto = match[3].trim();
      if (texto) {
        resultado.push({ tiempo, texto });
      }
    }
  }

  return resultado.sort((a, b) => a.tiempo - b.tiempo);
}

// Carga y renderiza el panel de letra
function renderizarLetra(cancion) {
  contenedorLetras.innerHTML = '';
  lineasLrcParseadas = [];
  elementosLineasDom = [];
  indiceLineaActiva = -1;

  if (cancion.lrc) {
    lineasLrcParseadas = parsearLRC(cancion.lrc);
  }

  if (lineasLrcParseadas.length > 0) {
    indicadorLrc.style.display = 'inline-block';

    lineasLrcParseadas.forEach((linea, index) => {
      const p = document.createElement('p');
      p.className = 'linea-lrc';
      p.textContent = linea.texto;
      p.setAttribute('data-tiempo', String(linea.tiempo));
      p.setAttribute('role', 'button');
      p.setAttribute('tabindex', '0');
      p.setAttribute('aria-label', `Saltar a ${formatearTiempo(linea.tiempo)}: ${linea.texto}`);

      // Al hacer clic salta al segundo correspondiente
      p.addEventListener('click', () => {
        audio.currentTime = linea.tiempo;
        audio.play().catch(() => {});
      });

      p.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          audio.currentTime = linea.tiempo;
          audio.play().catch(() => {});
        }
      });

      contenedorLetras.appendChild(p);
      elementosLineasDom.push(p);
    });
  } else {
    indicadorLrc.style.display = 'none';
    const divLetra = document.createElement('div');
    divLetra.className = 'letra-plana-texto';
    divLetra.textContent = cancion.letra || 'Letra no disponible para esta canción.';
    contenedorLetras.appendChild(divLetra);
  }
}

// Selecciona una canción y la carga en el reproductor
function seleccionarCancion(cancion, iniciarReproduccion = true) {
  cancionActiva = cancion;

  // Actualizar clases activas en la lista
  const items = contenedorLista.querySelectorAll('.cancion-item');
  items.forEach((item) => {
    if (item.getAttribute('data-id') === cancion.id) {
      item.classList.add('cancion-item--activa');
    } else {
      item.classList.remove('cancion-item--activa');
    }
  });

  // Mostrar reproductor
  estadoVacio.style.display = 'none';
  cuerpoReproductor.style.display = 'flex';

  const tema = mapaTemas.get(cancion.temaId);
  const nombreAsig = mapaAsignaturas.get(mapaTemaAsignatura.get(cancion.temaId)) || 'Materia';
  cancionTemaEtiqueta.textContent = `${nombreAsig} » ${tema ? tema.titulo : 'Tema'}`;
  cancionTitulo.textContent = cancion.titulo;
  cancionAutoria.textContent = `Autoría: ${cancion.autoria}`;
  cancionLicencia.textContent = `Licencia: ${cancion.licencia}`;

  if (esDocenteOAdmin) {
    bloqueEditarCancion.style.display = 'block';
    enlaceEditarCancion.href = `/paginas/editor-cancion.html?id=${encodeURIComponent(cancion.id)}`;
  } else {
    bloqueEditarCancion.style.display = 'none';
  }

  // Cargar audio
  audio.src = cancion.audio;
  audio.load();
  barraProgreso.value = 0;
  tiempoActual.textContent = '00:00';
  tiempoTotal.textContent = '00:00';

  renderizarLetra(cancion);

  if (iniciarReproduccion) {
    audio.play().catch((err) => {
      console.debug('Autoplay restringido por el navegador:', err.message);
    });
  }
}

// Renderiza la lista filtrada de canciones
function renderizarListaCanciones() {
  const asgSeleccionada = filtroAsignatura.value;
  const temaSeleccionado = filtroTema.value;

  const filtradas = todasCanciones.filter((c) => {
    const asgId = mapaTemaAsignatura.get(c.temaId);
    if (asgSeleccionada && asgId !== asgSeleccionada) return false;
    if (temaSeleccionado && c.temaId !== temaSeleccionado) return false;
    return true;
  });

  const total = filtradas.length;
  contadorCanciones.textContent = `${total} ${total === 1 ? 'canción disponible' : 'canciones disponibles'}`;

  contenedorLista.innerHTML = '';

  if (total === 0) {
    contenedorLista.innerHTML = `
      <div class="vacio" style="border: none; padding: var(--espacio-l);">
        <p style="margin-bottom: 0;">No hay canciones registradas para los filtros seleccionados.</p>
        ${
          esDocenteOAdmin
            ? `<a href="/paginas/editor-cancion.html" class="btn btn--primario btn--pequeno" style="margin-top: var(--espacio-s);">+ Agregar canción</a>`
            : ''
        }
      </div>
    `;
    return;
  }

  for (const c of filtradas) {
    const item = document.createElement('article');
    item.className = 'cancion-item';
    item.setAttribute('role', 'listitem');
    item.setAttribute('data-id', c.id);

    if (cancionActiva && cancionActiva.id === c.id) {
      item.classList.add('cancion-item--activa');
    }

    const tema = mapaTemas.get(c.temaId);
    const nombreTema = tema ? tema.titulo : 'Tema académico';

    item.innerHTML = `
      <div class="cancion-item__info">
        <span class="cancion-item__titulo">${escapar(c.titulo)}</span>
        <span class="cancion-item__meta">📚 ${escapar(nombreTema)}</span>
        <span class="cancion-item__meta" style="font-size: 11px;">✍️ ${escapar(c.autoria)}</span>
      </div>
      <div class="fila" style="gap: var(--espacio-xs); align-items: center;">
        <span class="insignia insignia--secundario" style="font-size: 10px;">${c.lrc ? 'LRC' : 'Audio'}</span>
      </div>
    `;

    item.addEventListener('click', () => {
      seleccionarCancion(c, true);
    });

    contenedorLista.appendChild(item);
  }

  // Si no hay canción seleccionada o la seleccionada ya no está en el filtro, seleccionar la primera
  if (filtradas.length > 0 && (!cancionActiva || !filtradas.some((c) => c.id === cancionActiva.id))) {
    seleccionarCancion(filtradas[0], false);
  }
}

// Llena los filtros desplegables de asignatura y tema
function poblarFiltros() {
  filtroAsignatura.innerHTML = '<option value="">Todas las asignaturas</option>';
  for (const asg of todasAsignaturas) {
    const opt = document.createElement('option');
    opt.value = asg.id;
    opt.textContent = asg.nombre;
    filtroAsignatura.appendChild(opt);
  }

  actualizarFiltroTemas();
}

function actualizarFiltroTemas() {
  const asgId = filtroAsignatura.value;
  filtroTema.innerHTML = '<option value="">Todos los temas</option>';

  const temasDisponibles = todosTemas.filter((t) => {
    if (!asgId) return true;
    return mapaTemaAsignatura.get(t.id) === asgId;
  });

  for (const t of temasDisponibles) {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = t.titulo;
    filtroTema.appendChild(opt);
  }
}

// Controles del reproductor propio
btnReproducir.addEventListener('click', async () => {
  if (audio.paused) {
    try {
      await audio.play();
    } catch (err) {
      console.warn('Fallo al reproducir:', err.message);
      if (cancionActiva && cancionActiva.audio && cancionActiva.audio.endsWith('.mp3')) {
        const rutaWav = cancionActiva.audio.replace(/\.mp3$/, '.wav');
        audio.src = rutaWav;
        audio.load();
        await audio.play().catch((e) => aviso(e.message, 'error'));
      } else {
        aviso(err.message || 'Error al iniciar reproducción de audio', 'error');
      }
    }
  } else {
    audio.pause();
  }
});

btnReiniciar.addEventListener('click', () => {
  audio.currentTime = 0;
  audio.play().catch(() => {});
});

audio.addEventListener('play', () => {
  iconoPlay.textContent = '❚❚';
  btnReproducir.setAttribute('aria-label', 'Pausar canción');
});

audio.addEventListener('pause', () => {
  iconoPlay.textContent = '▶';
  btnReproducir.setAttribute('aria-label', 'Reproducir canción');
});

audio.addEventListener('error', () => {
  const err = audio.error;
  console.warn('Aviso en elemento de audio:', err ? `${err.code}` : 'error');
  if (cancionActiva && cancionActiva.audio && cancionActiva.audio.endsWith('.mp3')) {
    const rutaWav = cancionActiva.audio.replace(/\.mp3$/, '.wav');
    if (!audio.src.endsWith(rutaWav)) {
      audio.src = rutaWav;
      audio.load();
    }
  }
});

audio.addEventListener('loadedmetadata', () => {
  tiempoTotal.textContent = formatearTiempo(audio.duration);
});

audio.addEventListener('timeupdate', () => {
  if (!isNaN(audio.duration) && audio.duration > 0) {
    barraProgreso.value = (audio.currentTime / audio.duration) * 100;
  }
  tiempoActual.textContent = formatearTiempo(audio.currentTime);

  // Sincronización en vivo con letra LRC
  if (lineasLrcParseadas.length > 0) {
    const curTime = audio.currentTime;
    let nuevoIndice = -1;

    for (let i = 0; i < lineasLrcParseadas.length; i++) {
      if (curTime >= lineasLrcParseadas[i].tiempo) {
        nuevoIndice = i;
      } else {
        break;
      }
    }

    if (nuevoIndice !== indiceLineaActiva) {
      if (indiceLineaActiva >= 0 && elementosLineasDom[indiceLineaActiva]) {
        elementosLineasDom[indiceLineaActiva].classList.remove('linea-lrc--activa');
      }

      indiceLineaActiva = nuevoIndice;

      if (indiceLineaActiva >= 0 && elementosLineasDom[indiceLineaActiva]) {
        const elementoActivo = elementosLineasDom[indiceLineaActiva];
        elementoActivo.classList.add('linea-lrc--activa');

        // Desplazamiento suave centrado en el panel
        elementoActivo.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
      }
    }
  }
});

audio.addEventListener('ended', () => {
  iconoPlay.textContent = '▶';
  barraProgreso.value = 0;
  tiempoActual.textContent = '00:00';
});

// Barra de progreso operable
barraProgreso.addEventListener('input', () => {
  if (!isNaN(audio.duration) && audio.duration > 0) {
    audio.currentTime = (barraProgreso.value / 100) * audio.duration;
  }
});

// Control de volumen
barraVolumen.addEventListener('input', () => {
  audio.volume = parseFloat(barraVolumen.value);
  audio.muted = false;
  iconoVolumen.textContent = audio.volume === 0 ? '🔇' : '🔊';
});

btnSilenciar.addEventListener('click', () => {
  audio.muted = !audio.muted;
  iconoVolumen.textContent = audio.muted || audio.volume === 0 ? '🔇' : '🔊';
});

// Eventos de filtros
filtroAsignatura.addEventListener('change', () => {
  actualizarFiltroTemas();
  renderizarListaCanciones();
});

filtroTema.addEventListener('change', () => {
  renderizarListaCanciones();
});

// Carga inicial
async function cargarDatos() {
  cargando(true);
  try {
    const [canciones, asignaturas, unidades, temas] = await Promise.all([
      api.listar('canciones'),
      api.listar('asignaturas'),
      api.listar('unidades'),
      api.listar('temas')
    ]);

    todasCanciones = canciones || [];
    todasAsignaturas = asignaturas || [];
    todasUnidades = unidades || [];
    todosTemas = temas || [];

    mapaAsignaturas = new Map(todasAsignaturas.map((a) => [a.id, a.nombre]));
    mapaUnidades = new Map(todasUnidades.map((u) => [u.id, u.asignaturaId]));
    mapaTemas = new Map(todosTemas.map((t) => [t.id, t]));

    mapaTemaAsignatura.clear();
    for (const t of todosTemas) {
      mapaTemaAsignatura.set(t.id, mapaUnidades.get(t.unidadId));
    }

    poblarFiltros();

    // Si viene ?temaId= preseleccionarlo
    if (temaIdParam) {
      const asgId = mapaTemaAsignatura.get(temaIdParam);
      if (asgId) {
        filtroAsignatura.value = asgId;
        actualizarFiltroTemas();
      }
      filtroTema.value = temaIdParam;
    }

    renderizarListaCanciones();
  } catch (error) {
    aviso(error.message || 'Error al cargar las canciones', 'error');
  } finally {
    cargando(false);
  }
}

await cargarDatos();
