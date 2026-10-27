// publico/js/modulos/tema.js · Vista de aprendizaje y estudio del tema
import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import { aviso, cargando, escapar } from '../nucleo/ui.js';
import { parametro, formatoBasico } from '../nucleo/util.js';
import { ACTIVIDADES } from '../nucleo/catalogo-actividades.js';

await montarPlantilla({ titulo: 'Tema', roles: ['estudiante', 'docente', 'admin'] });

const temaId = parametro('id');

const migaPanLista = document.getElementById('miga-pan-lista');
const temaTitulo = document.getElementById('tema-titulo');
const temaUnidadEtiqueta = document.getElementById('tema-unidad-etiqueta');
const btnMarcarRevisado = document.getElementById('btn-marcar-revisado');

const seccionObjetivos = document.getElementById('seccion-objetivos');
const listaObjetivos = document.getElementById('lista-objetivos');

const cuerpoResumen = document.getElementById('cuerpo-resumen');

const seccionEjemplos = document.getElementById('seccion-ejemplos');
const listaEjemplos = document.getElementById('lista-ejemplos');

const seccionRecursos = document.getElementById('seccion-recursos');
const listaRecursos = document.getElementById('lista-recursos');

const contenedorActividades = document.getElementById('contenedor-actividades');

// Detectar ID de video YouTube
function extraerIdYouTube(url) {
  if (!url) return null;
  const match = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
  return match ? match[1] : null;
}

// Detectar ID de video Vimeo
function extraerIdVimeo(url) {
  if (!url) return null;
  const match = url.match(/(?:vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/([^\/]*)\/videos\/|album\/(\d+)\/video\/|))(\d+)/i);
  return match ? (match[3] || match[2] || match[1]) : null;
}

async function cargarTema() {
  if (!temaId) {
    aviso('No se especificó ningún tema para estudiar', 'error');
    temaTitulo.textContent = 'Tema no encontrado';
    btnMarcarRevisado.disabled = true;
    return;
  }

  cargando(true);
  try {
    const [tema, todasUnidades, progreso] = await Promise.all([
      api.obtener('temas', temaId),
      api.listar('unidades'),
      api.listar('progreso-temas')
    ]);

    if (!tema) {
      throw new Error('El tema solicitado no existe o fue retirado');
    }

    // Guardar último tema visitado en localStorage
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('ultimoTema', JSON.stringify({ id: tema.id, titulo: tema.titulo }));
    }

    // Cargar unidad y asignatura para las migas de pan
    const unidad = todasUnidades.find((u) => u.id === tema.unidadId);
    let asignatura = null;
    if (unidad?.asignaturaId) {
      try {
        asignatura = await api.obtener('asignaturas', unidad.asignaturaId);
      } catch {
        asignatura = null;
      }
    }

    document.title = `${tema.titulo} · Ecosistema Educativo`;
    temaTitulo.textContent = tema.titulo;
    temaUnidadEtiqueta.textContent = unidad ? `Unidad ${unidad.orden || 1}: ${unidad.titulo}` : 'Contenido académico';

    // Migas de pan
    migaPanLista.innerHTML = `
      <li><a href="/paginas/asignaturas.html">Mis asignaturas</a></li>
      ${asignatura ? `<li><a href="/paginas/asignatura.html?id=${encodeURIComponent(asignatura.id)}">${escapar(asignatura.nombre)}</a></li>` : ''}
      ${unidad ? `<li><span>${escapar(unidad.titulo)}</span></li>` : ''}
      <li aria-current="page"><strong>${escapar(tema.titulo)}</strong></li>
    `;

    // Estado del botón "Marcar como revisado"
    const yaRevisado = progreso.some((p) => p.temaId === temaId);
    if (yaRevisado) {
      btnMarcarRevisado.textContent = 'Revisado ✓';
      btnMarcarRevisado.className = 'btn btn--secundario';
      btnMarcarRevisado.disabled = true;
    } else {
      btnMarcarRevisado.addEventListener('click', async () => {
        cargando(true);
        try {
          await api.crear('progreso-temas', { temaId });
          btnMarcarRevisado.textContent = 'Revisado ✓';
          btnMarcarRevisado.className = 'btn btn--secundario';
          btnMarcarRevisado.disabled = true;
          aviso('¡Tema marcado como revisado!', 'exito');
        } catch (err) {
          aviso(err.message || 'Error al registrar progreso', 'error');
        } finally {
          cargando(false);
        }
      });
    }

    // 1. Objetivos de aprendizaje
    if (Array.isArray(tema.objetivos) && tema.objetivos.length > 0) {
      listaObjetivos.innerHTML = tema.objetivos
        .map((obj) => `<li>${escapar(obj)}</li>`)
        .join('');
      seccionObjetivos.classList.remove('oculto');
    } else {
      seccionObjetivos.classList.add('oculto');
    }

    // 2. Resumen didáctico con formato básico seguro
    if (tema.resumen) {
      cuerpoResumen.innerHTML = formatoBasico(tema.resumen);
    } else {
      cuerpoResumen.innerHTML = '<p style="color: var(--color-texto-suave);">El docente aún no ha publicado el resumen de este tema.</p>';
    }

    // 3. Ejemplos de aplicación
    if (Array.isArray(tema.ejemplos) && tema.ejemplos.length > 0) {
      listaEjemplos.innerHTML = tema.ejemplos
        .map((ej) => `<li class="tema-ejemplo-item">${escapar(ej)}</li>`)
        .join('');
      seccionEjemplos.classList.remove('oculto');
    } else {
      seccionEjemplos.classList.add('oculto');
    }

    // 4. Recursos didácticos y multimedia
    if (Array.isArray(tema.recursos) && tema.recursos.length > 0) {
      listaRecursos.innerHTML = tema.recursos
        .map((rec) => {
          const ytId = extraerIdYouTube(rec.url);
          const vimeoId = extraerIdVimeo(rec.url);

          if (rec.tipo === 'video' || ytId || vimeoId) {
            const embedSrc = ytId
              ? `https://www.youtube-nocookie.com/embed/${ytId}`
              : `https://player.vimeo.com/video/${vimeoId}`;

            return `
              <div class="recurso-video-box">
                <iframe src="${embedSrc}" title="${escapar(rec.titulo || 'Video educativo')}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
              </div>
            `;
          }

          if (rec.tipo === 'imagen' || /\.(jpe?g|png|webp|gif)$/i.test(rec.url)) {
            return `
              <figure class="recurso-imagen-box">
                <img src="${escapar(rec.url)}" alt="${escapar(rec.titulo || 'Imagen ilustrativa')}" loading="lazy">
                <figcaption>${escapar(rec.titulo || 'Ilustración del tema')}</figcaption>
              </figure>
            `;
          }

          if (rec.tipo === 'pdf' || /\.pdf$/i.test(rec.url)) {
            return `
              <div class="recurso-archivo-box">
                <span aria-hidden="true" style="font-size: var(--tamano-xl);">📄</span>
                <div class="pila" style="gap: 2px;">
                  <a href="${escapar(rec.url)}" target="_blank" rel="noopener noreferrer" style="font-weight: var(--peso-seminegrita);">
                    ${escapar(rec.titulo || 'Documento PDF')} (Abrir archivo)
                  </a>
                  <span style="font-size: var(--tamano-xs); color: var(--color-texto-suave);">Lectura complementaria en PDF</span>
                </div>
              </div>
            `;
          }

          return `
            <div class="recurso-archivo-box">
              <span aria-hidden="true" style="font-size: var(--tamano-xl);">🔗</span>
              <div class="pila" style="gap: 2px;">
                <a href="${escapar(rec.url)}" target="_blank" rel="noopener noreferrer" style="font-weight: var(--peso-seminegrita);">
                  ${escapar(rec.titulo || 'Recurso web')}
                </a>
                <span style="font-size: var(--tamano-xs); color: var(--color-texto-suave);">Enlace de consulta externa</span>
              </div>
            </div>
          `;
        })
        .join('');
      seccionRecursos.classList.remove('oculto');
    } else {
      seccionRecursos.classList.add('oculto');
    }

    // 5. Bloque "Practica este tema"
    if (Array.isArray(ACTIVIDADES) && ACTIVIDADES.length > 0) {
      contenedorActividades.innerHTML = ACTIVIDADES
        .map(
          (act) => `
            <div class="actividad-card">
              <div>
                <h3 style="font-size: var(--tamano-base); font-weight: var(--peso-negrita); color: var(--color-primario); margin-bottom: var(--espacio-xs);">
                  ${escapar(act.texto)}
                </h3>
                <p style="font-size: var(--tamano-xs); color: var(--color-texto-suave);">
                  ${escapar(act.descripcion || 'Práctica interactiva para afianzar conocimientos.')}
                </p>
              </div>
              <a href="${escapar(act.href)}?temaId=${encodeURIComponent(tema.id)}" class="btn btn--primario btn--pequeno" style="text-align: center;">
                Practicar →
              </a>
            </div>
          `
        )
        .join('');
    } else {
      contenedorActividades.innerHTML = `
        <div class="alerta alerta--info" style="margin: 0; width: 100%;">
          Próximamente se integrarán actividades interactivas y juegos para practicar este tema.
        </div>
      `;
    }
  } catch (error) {
    aviso(error.message || 'Error al cargar tema', 'error');
  } finally {
    cargando(false);
  }
}

await cargarTema();
