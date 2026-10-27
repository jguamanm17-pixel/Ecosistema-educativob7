// publico/js/modulos/asignatura.js · Vista de unidades, temas y tutor virtual socrático IA
import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import { aviso, cargando, escapar } from '../nucleo/ui.js';
import { parametro, formatoBasico } from '../nucleo/util.js';
import { usuarioActual } from '../nucleo/sesion.js';
import { calcularAvance } from './asignaturas.js';

await montarPlantilla({ titulo: 'Asignatura', roles: ['estudiante', 'docente', 'admin'] });

const rawId = parametro('id');

const materiaTitulo = document.getElementById('materia-titulo');
const materiaNivel = document.getElementById('materia-nivel');
const materiaDescripcion = document.getElementById('materia-descripcion');
const materiaAvanceBox = document.getElementById('materia-resumen-avance');
const contenedorUnidades = document.getElementById('contenedor-unidades');

// Elementos de la interfaz del Tutor Socrático
const btnIniciarTutorBanner = document.getElementById('btn-iniciar-tutor-banner');
const btnTutorFlotante = document.getElementById('btn-tutor-flotante');
const tutorPanel = document.getElementById('tutor-panel');
const btnTutorCerrar = document.getElementById('btn-tutor-cerrar');
const btnTutorReiniciar = document.getElementById('btn-tutor-reiniciar');
const tutorChatAsgNombre = document.getElementById('tutor-chat-asg-nombre');
const tutorTemaSelector = document.getElementById('tutor-tema-selector');
const tutorMensajes = document.getElementById('tutor-mensajes');
const tutorPensando = document.getElementById('tutor-pensando');
const tutorSugerencias = document.getElementById('tutor-sugerencias');
const tutorFormulario = document.getElementById('tutor-formulario');
const tutorInput = document.getElementById('tutor-input');
const btnPedirPista = document.getElementById('btn-pedir-pista');
const tutorContadorHoy = document.getElementById('tutor-contador-hoy');

// Estado de la sesión del tutor socrático
let asignaturaActual = null;
let temasPublicadosAsignatura = [];
let historialConversacion = [];
let totalConsultasHoy = 0;

async function resolverAsignaturaId() {
  if (rawId) return rawId;
  try {
    const misAsignaturas = await api.listar('asignaturas');
    if (misAsignaturas && misAsignaturas.length > 0) {
      if (misAsignaturas.length === 1) {
        const idUnico = misAsignaturas[0].id;
        try {
          history.replaceState(null, '', `/paginas/asignatura.html?id=${encodeURIComponent(idUnico)}`);
        } catch {}
        return idUnico;
      }
      window.location.replace('/paginas/asignaturas.html');
      return null;
    }
  } catch (err) {
    console.error('Error al resolver asignaturas:', err);
  }
  return null;
}

// -----------------------------------------------------------------------------
// CONTROL DEL WIDGET DEL TUTOR SOCRÁTICO
// -----------------------------------------------------------------------------

function abrirTutorChat(focoTemaId = null) {
  if (!tutorPanel) return;
  tutorPanel.hidden = false;
  btnTutorFlotante?.setAttribute('aria-expanded', 'true');

  if (focoTemaId && tutorTemaSelector) {
    tutorTemaSelector.value = focoTemaId;
  }

  tutorMensajes.scrollTop = tutorMensajes.scrollHeight;
  setTimeout(() => tutorInput?.focus(), 150);
}

function cerrarTutorChat() {
  if (!tutorPanel) return;
  tutorPanel.hidden = true;
  btnTutorFlotante?.setAttribute('aria-expanded', 'false');
}

function formatearHora(isoString = new Date().toISOString()) {
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function renderizarMensaje(rol, texto, fecha = new Date().toISOString()) {
  if (!tutorMensajes) return;

  const esEstudiante = rol === 'estudiante';
  const fila = document.createElement('div');
  fila.className = `tutor-msg tutor-msg--${esEstudiante ? 'estudiante' : 'tutor'}`;

  const burbuja = document.createElement('div');
  burbuja.className = 'tutor-msg-burbuja';

  if (esEstudiante) {
    burbuja.textContent = texto;
  } else {
    // Formato enriquecido y seguro para respuestas pedagógicas
    burbuja.innerHTML = formatoBasico(texto);
  }

  const meta = document.createElement('div');
  meta.className = 'tutor-msg-meta';
  meta.innerHTML = `
    <span>${esEstudiante ? 'Tú' : 'Tutor Socrático'}</span>
    <span>·</span>
    <time datetime="${fecha}">${formatearHora(fecha)}</time>
  `;

  fila.appendChild(burbuja);
  fila.appendChild(meta);
  tutorMensajes.appendChild(fila);
  tutorMensajes.scrollTop = tutorMensajes.scrollHeight;
}

function cargarHistorialDeSesion() {
  if (!asignaturaActual) return;
  const claveStorage = `tutor_historial_${asignaturaActual.id}`;
  try {
    const guardado = sessionStorage.getItem(claveStorage);
    if (guardado) {
      historialConversacion = JSON.parse(guardado);
    }
  } catch {
    historialConversacion = [];
  }

  tutorMensajes.innerHTML = '';

  if (historialConversacion.length === 0) {
    const usuario = usuarioActual();
    const saludoNombre = usuario?.nombre ? `, ${usuario.nombre}` : '';
    const bienvenida = `¡Hola${saludoNombre}! Soy tu **Tutor Virtual Socrático** para la asignatura *${asignaturaActual.nombre}*.\n\nMi objetivo no es darte respuestas directas, sino formular preguntas orientadoras y ofrecerte pistas progresivas para que descubras y razones cada concepto por ti mismo.\n\n¿Qué duda o tema de esta asignatura te gustaría que analicemos hoy?`;

    renderizarMensaje('tutor', bienvenida);
    historialConversacion.push({
      rol: 'tutor',
      texto: bienvenida,
      fecha: new Date().toISOString()
    });
    guardarHistorialEnSesion();
  } else {
    historialConversacion.forEach((m) => {
      renderizarMensaje(m.rol, m.texto, m.fecha);
    });
  }
}

function guardarHistorialEnSesion() {
  if (!asignaturaActual) return;
  const claveStorage = `tutor_historial_${asignaturaActual.id}`;
  try {
    sessionStorage.setItem(claveStorage, JSON.stringify(historialConversacion));
  } catch {}
}

function reiniciarSesionTutor() {
  if (!asignaturaActual) return;
  const claveStorage = `tutor_historial_${asignaturaActual.id}`;
  try {
    sessionStorage.removeItem(claveStorage);
  } catch {}
  historialConversacion = [];
  cargarHistorialDeSesion();
  aviso('Sesión de tutoría socrática reiniciada', 'info');
}

async function actualizarContadorConsultas() {
  if (!tutorContadorHoy) return;
  try {
    const hoy = new Date().toISOString().slice(0, 10);
    const usuario = usuarioActual();
    if (!usuario) return;

    const consultas = await api.listar('consultas-tutor', { usuarioId: usuario.id, dia: hoy });
    const total = (consultas || []).reduce((acc, c) => acc + (Number(c.mensajes) || 1), 0);
    totalConsultasHoy = total;
    tutorContadorHoy.textContent = `Consultas hoy: ${totalConsultasHoy} / 40`;
  } catch {
    tutorContadorHoy.textContent = 'Tutor IA activo';
  }
}

function configurarSugerenciasTematicas() {
  if (!tutorSugerencias) return;
  tutorSugerencias.innerHTML = '';

  const sugerencias = [
    '¿Cuál es la regla de oro para la protección colectiva?',
    '¿Cómo determino si un arnés de seguridad debe descartarse?',
    '¿Qué medidas previenen derrumbes en excavaciones?',
    '¿Por qué se prioriza el EPC frente al EPI?'
  ];

  // Si hay preguntas guía registradas en los temas, usarlas
  temasPublicadosAsignatura.forEach((t) => {
    if (Array.isArray(t.preguntasGuia) && t.preguntasGuia.length > 0) {
      sugerencias.unshift(t.preguntasGuia[0]);
    }
  });

  const unicas = Array.from(new Set(sugerencias)).slice(0, 5);

  unicas.forEach((textoPregunta) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'tutor-chip-sugerencia';
    chip.textContent = textoPregunta;
    chip.addEventListener('click', () => {
      if (tutorInput) {
        tutorInput.value = textoPregunta;
        enviarConsultaTutor();
      }
    });
    tutorSugerencias.appendChild(chip);
  });
}

async function enviarConsultaTutor(mensajeExtra = null) {
  const texto = (mensajeExtra || tutorInput?.value || '').trim();
  if (!texto || !asignaturaActual) return;

  const temaSeleccionado = tutorTemaSelector?.value || 'todos';

  // 1. Mostrar mensaje del estudiante
  renderizarMensaje('estudiante', texto);
  historialConversacion.push({
    rol: 'estudiante',
    texto,
    fecha: new Date().toISOString()
  });
  guardarHistorialEnSesion();

  if (tutorInput) tutorInput.value = '';

  // 2. Estado de razonamiento / pensamiento
  if (tutorPensando) tutorPensando.hidden = false;
  if (tutorInput) tutorInput.disabled = true;
  const btnEnviar = document.getElementById('btn-tutor-enviar');
  if (btnEnviar) btnEnviar.disabled = true;

  try {
    // 3. Consulta a la API con IA
    const respuestaServidor = await api.ia('tutor', {
      asignaturaId: asignaturaActual.id,
      temaId: temaSeleccionado !== 'todos' ? temaSeleccionado : null,
      pregunta: texto,
      historial: historialConversacion.slice(-8)
    });

    const textoRespuesta =
      (respuestaServidor && typeof respuestaServidor === 'object' && respuestaServidor.respuesta)
        ? respuestaServidor.respuesta
        : (typeof respuestaServidor === 'string' ? respuestaServidor : 'Continuemos analizando: ¿cuál es tu reflexión inicial?');

    // 4. Mostrar respuesta socrática del tutor
    renderizarMensaje('tutor', textoRespuesta);
    historialConversacion.push({
      rol: 'tutor',
      texto: textoRespuesta,
      fecha: new Date().toISOString()
    });
    guardarHistorialEnSesion();
    await actualizarContadorConsultas();
  } catch (error) {
    const errorMsg = `⚠️ ${error.message || 'No se pudo obtener respuesta del tutor socrático en este momento.'}`;
    renderizarMensaje('tutor', errorMsg);
  } finally {
    if (tutorPensando) tutorPensando.hidden = true;
    if (tutorInput) {
      tutorInput.disabled = false;
      tutorInput.focus();
    }
    if (btnEnviar) btnEnviar.disabled = false;
  }
}

// -----------------------------------------------------------------------------
// CARGA PRINCIPAL DE CONTENIDOS DE LA ASIGNATURA
// -----------------------------------------------------------------------------

async function cargarContenidosAsignatura() {
  const asgId = await resolverAsignaturaId();

  if (!asgId) {
    materiaTitulo.textContent = 'Asignatura no especificada';
    if (materiaDescripcion) materiaDescripcion.textContent = 'Selecciona una asignatura desde tu catálogo.';
    contenedorUnidades.innerHTML = `
      <div class="tarjeta" style="text-align: center; padding: var(--espacio-xl);">
        <p style="color: var(--color-texto-suave); margin-bottom: var(--espacio-m);">No se encontró ninguna asignatura seleccionada o asignada a tu usuario.</p>
        <a href="/paginas/asignaturas.html" class="btn btn--primario">Ir a Mis asignaturas</a>
      </div>
    `;
    return;
  }

  cargando(true);
  try {
    const [asignatura, todasUnidades, todosTemas, progreso, avance] = await Promise.all([
      api.obtener('asignaturas', asgId),
      api.listar('unidades'),
      api.listar('temas'),
      api.listar('progreso-temas'),
      calcularAvance(asgId)
    ]);

    if (!asignatura) {
      throw new Error('Asignatura no encontrada');
    }

    asignaturaActual = asignatura;
    document.title = `${asignatura.nombre} · Ecosistema Educativo`;
    materiaTitulo.textContent = asignatura.nombre;
    materiaNivel.textContent = asignatura.nivel || 'Educación Superior';
    materiaDescripcion.textContent = asignatura.descripcion || 'Sin descripción disponible.';

    if (tutorChatAsgNombre) {
      tutorChatAsgNombre.textContent = asignatura.nombre;
    }

    // Caja de avance general
    if (materiaAvanceBox) {
      materiaAvanceBox.innerHTML = `
        <div class="fila" style="justify-content: space-between; align-items: center; font-size: var(--tamano-xs); margin-bottom: 4px;">
          <span>Avance general:</span>
          <strong style="color: var(--color-primario);">${avance.porcentaje}%</strong>
        </div>
        <div class="progreso" role="progressbar" aria-valuenow="${avance.porcentaje}" aria-valuemin="0" aria-valuemax="100" style="height: 8px;">
          <div class="progreso__barra" style="width: ${avance.porcentaje}%;"></div>
        </div>
        <span style="font-size: 11px; color: var(--color-texto-suave); margin-top: 2px;">
          ${avance.revisados} de ${avance.total} temas revisados
        </span>
      `;
    }

    // Unidades visibles de la asignatura
    const unidades = (todasUnidades || [])
      .filter((u) => u.asignaturaId === asgId && u.visible !== false)
      .sort((a, b) => (Number(a.orden) || 0) - (Number(b.orden) || 0));

    // Temas publicados de la asignatura
    const idsUnidades = new Set(unidades.map((u) => u.id));
    temasPublicadosAsignatura = (todosTemas || [])
      .filter((t) => idsUnidades.has(t.unidadId) && t.estado === 'publicado')
      .sort((a, b) => (Number(a.orden) || 0) - (Number(b.orden) || 0));

    // Poblar selector de foco del tutor
    if (tutorTemaSelector) {
      tutorTemaSelector.innerHTML = '<option value="todos">Toda la asignatura (General)</option>';
      temasPublicadosAsignatura.forEach((t) => {
        const opt = document.createElement('option');
        opt.value = t.id;
        opt.textContent = `Tema: ${t.titulo}`;
        tutorTemaSelector.appendChild(opt);
      });
    }

    configurarSugerenciasTematicas();
    cargarHistorialDeSesion();
    await actualizarContadorConsultas();

    if (unidades.length === 0) {
      contenedorUnidades.innerHTML = `
        <div class="tarjeta" style="text-align: center; padding: var(--espacio-xl); color: var(--color-texto-suave);">
          Esta asignatura aún no tiene unidades visibles publicadas.
        </div>
      `;
      return;
    }

    // Set de IDs revisados
    const idsRevisados = new Set((progreso || []).map((p) => p.temaId));

    contenedorUnidades.innerHTML = '';

    for (const unidad of unidades) {
      const temasDeEstaUnidad = temasPublicadosAsignatura
        .filter((t) => t.unidadId === unidad.id);

      const bloque = document.createElement('section');
      bloque.className = 'unidad-bloque';
      bloque.setAttribute('aria-label', unidad.titulo);

      const headerHtml = `
        <div class="unidad-bloque__cabecera">
          <div class="fila" style="gap: var(--espacio-s); align-items: center;">
            <span class="insignia insignia--secundario" style="font-weight: var(--peso-negrita);">Unidad ${unidad.orden || 1}</span>
            <h2 class="unidad-bloque__titulo">${escapar(unidad.titulo)}</h2>
          </div>
          <span style="font-size: var(--tamano-xs); color: var(--color-texto-suave);">
            ${temasDeEstaUnidad.length} ${temasDeEstaUnidad.length === 1 ? 'tema' : 'temas'}
          </span>
        </div>
      `;

      let temasHtml = '';
      if (temasDeEstaUnidad.length === 0) {
        temasHtml = `
          <div style="padding: var(--espacio-m); font-size: var(--tamano-sm); color: var(--color-texto-suave); text-align: center;">
            No hay temas publicados en esta unidad.
          </div>
        `;
      } else {
        temasHtml = `
          <div class="unidad-bloque__temas" role="list">
            ${temasDeEstaUnidad
              .map((tema) => {
                const revisado = idsRevisados.has(tema.id);
                const badgeEstado = revisado
                  ? '<span class="insignia insignia--exito" style="font-size: var(--tamano-xs);">Revisado ✓</span>'
                  : '<span class="insignia insignia--advertencia" style="font-size: var(--tamano-xs);">Pendiente</span>';

                return `
                  <article class="tema-academico-fila" role="listitem">
                    <div class="tema-academico-info">
                      <span class="tema-academico-orden">${tema.orden || 1}</span>
                      <span class="tema-academico-titulo">${escapar(tema.titulo)}</span>
                    </div>
                    <div class="tema-academico-acciones">
                      ${badgeEstado}
                      <button
                        type="button"
                        class="btn btn--texto btn-tutor-tema-rapido"
                        data-tema-id="${tema.id}"
                        style="font-size: var(--tamano-xs); color: var(--color-acento);"
                        title="Hacer una consulta socrática sobre este tema"
                      >
                        🤖 Tutor socrático
                      </button>
                      <a href="/paginas/tema.html?id=${encodeURIComponent(tema.id)}" class="btn btn--secundario btn--pequeno" aria-label="Estudiar tema ${escapar(tema.titulo)}">
                        Estudiar tema →
                      </a>
                    </div>
                  </article>
                `;
              })
              .join('')}
          </div>
        `;
      }

      bloque.innerHTML = headerHtml + temasHtml;
      contenedorUnidades.appendChild(bloque);
    }

    // Asignar listeners a botones rápidos de tutor por tema
    contenedorUnidades.querySelectorAll('.btn-tutor-tema-rapido').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tId = btn.getAttribute('data-tema-id');
        abrirTutorChat(tId);
      });
    });

  } catch (error) {
    materiaTitulo.textContent = 'Error al cargar';
    contenedorUnidades.innerHTML = `
      <div class="tarjeta" style="text-align: center; padding: var(--espacio-xl); color: var(--color-error);">
        <p style="font-weight: var(--peso-negrita); margin-bottom: var(--espacio-xs);">${escapar(error.message || 'Error al cargar los contenidos académicos')}</p>
        <a href="/paginas/asignaturas.html" class="btn btn--secundario" style="margin-top: var(--espacio-m);">Volver a Mis asignaturas</a>
      </div>
    `;
    aviso(error.message || 'Error al cargar contenidos de la asignatura', 'error');
  } finally {
    cargando(false);
  }
}

// -----------------------------------------------------------------------------
// EVENT LISTENERS DEL TUTOR SOCRÁTICO
// -----------------------------------------------------------------------------

btnIniciarTutorBanner?.addEventListener('click', () => abrirTutorChat());
btnTutorFlotante?.addEventListener('click', () => {
  if (tutorPanel?.hidden) {
    abrirTutorChat();
  } else {
    cerrarTutorChat();
  }
});
btnTutorCerrar?.addEventListener('click', () => cerrarTutorChat());
btnTutorReiniciar?.addEventListener('click', () => reiniciarSesionTutor());

tutorFormulario?.addEventListener('submit', (e) => {
  e.preventDefault();
  enviarConsultaTutor();
});

tutorInput?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    enviarConsultaTutor();
  }
});

btnPedirPista?.addEventListener('click', () => {
  enviarConsultaTutor('Por favor, ¿podrías darme una pista socrática para guiar mi razonamiento?');
});

await cargarContenidosAsignatura();
