// publico/js/modulos/inicio.js · Controlador de la página de inicio
import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import { usuarioActual } from '../nucleo/sesion.js';
import { cargando, escapar } from '../nucleo/ui.js';
import { fechaRelativa } from '../nucleo/util.js';
import { calcularAvance } from './asignaturas.js';

await montarPlantilla({ titulo: 'Inicio', roles: ['publico'] });

const usuario = usuarioActual();

const vistaPublica = document.getElementById('vista-publica');
const vistaAutenticada = document.getElementById('vista-autenticada');

const saludoUsuario = document.getElementById('saludo-usuario');
const rolUsuarioBadge = document.getElementById('rol-usuario-badge');
const seccionAccesosDocente = document.getElementById('seccion-accesos-docente');

const seccionContinuar = document.getElementById('seccion-continuar');
const continuarTemaTitulo = document.getElementById('continuar-tema-titulo');
const continuarEnlace = document.getElementById('continuar-enlace');

const contenedorMisAsignaturas = document.getElementById('contenedor-mis-asignaturas');
const contenedorNoticiasRecientes = document.getElementById('contenedor-noticias-recientes');

// Renderiza la sección "Continuar donde te quedaste" a partir de localStorage
function montarContinuarEstudio() {
  if (typeof localStorage === 'undefined') return;

  try {
    const raw = localStorage.getItem('ultimoTema');
    if (!raw) return;

    const ultimoTema = JSON.parse(raw);
    if (ultimoTema && ultimoTema.id && ultimoTema.titulo) {
      continuarTemaTitulo.textContent = ultimoTema.titulo;
      continuarEnlace.href = `/paginas/tema.html?id=${encodeURIComponent(ultimoTema.id)}`;
      seccionContinuar.style.display = 'block';
    }
  } catch (err) {
    console.debug('Aviso al recuperar ultimoTema:', err.message);
  }
}

// Carga las asignaturas del usuario y calcula el avance de cada una
async function cargarMisAsignaturas() {
  try {
    const asignaturas = await api.listar('asignaturas');

    if (!asignaturas || asignaturas.length === 0) {
      contenedorMisAsignaturas.innerHTML = `
        <div class="tarjeta" style="grid-column: 1 / -1; text-align: center; color: var(--color-texto-suave); padding: var(--espacio-l);">
          No tienes asignaturas matriculadas actualmente.
        </div>
      `;
      return;
    }

    contenedorMisAsignaturas.innerHTML = '';

    for (const asg of asignaturas) {
      const avance = await calcularAvance(asg.id);

      const card = document.createElement('article');
      card.className = 'asig-tarjeta-resumen';

      card.innerHTML = `
        <div class="pila" style="gap: var(--espacio-xs);">
          <span class="asig-tarjeta-resumen__nivel">${escapar(asg.nivel || 'Educación Superior')}</span>
          <h3 class="asig-tarjeta-resumen__titulo">${escapar(asg.nombre)}</h3>
        </div>

        <div class="pila" style="gap: var(--espacio-xs);">
          <div class="fila" style="justify-content: space-between; font-size: var(--tamano-xs); color: var(--color-texto-suave);">
            <span>Progreso de contenidos</span>
            <strong style="color: var(--color-primario);">${avance.porcentaje}%</strong>
          </div>
          <div class="progreso" role="progressbar" aria-valuenow="${avance.porcentaje}" aria-valuemin="0" aria-valuemax="100" style="height: 8px;">
            <div class="progreso__barra" style="width: ${avance.porcentaje}%;"></div>
          </div>
          <span style="font-size: 11px; color: var(--color-texto-suave);">
            ${avance.revisados} de ${avance.total} temas revisados
          </span>
          <div style="margin-top: var(--espacio-s);">
            <a href="/paginas/asignatura.html?id=${encodeURIComponent(asg.id)}" class="btn btn--primario btn--pequeno" style="width: 100%; text-align: center;">
              Ir al contenido académico →
            </a>
          </div>
        </div>
      `;

      contenedorMisAsignaturas.appendChild(card);
    }
  } catch (error) {
    console.error('Error al cargar mis asignaturas en inicio:', error);
    contenedorMisAsignaturas.innerHTML = `
      <div class="tarjeta" style="grid-column: 1 / -1; text-align: center; color: var(--color-error); padding: var(--espacio-l);">
        Error al cargar asignaturas.
      </div>
    `;
  }
}

// Carga las 3 noticias publicadas más recientes con destacadas primero
async function cargarNoticiasRecientes() {
  try {
    const noticias = await api.listar('noticias');
    const publicadas = (noticias || []).filter((n) => n.estado === 'publicado');

    // Ordenar: destacadas primero y luego por fecha más reciente
    publicadas.sort((a, b) => {
      if (Boolean(a.destacada) !== Boolean(b.destacada)) {
        return a.destacada ? -1 : 1;
      }
      const fechaA = new Date(a.fechaPublicacion || a.fecha || 0).getTime();
      const fechaB = new Date(b.fechaPublicacion || b.fecha || 0).getTime();
      return fechaB - fechaA;
    });

    const top3 = publicadas.slice(0, 3);

    if (top3.length === 0) {
      contenedorNoticiasRecientes.innerHTML = `
        <div class="tarjeta" style="grid-column: 1 / -1; text-align: center; color: var(--color-texto-suave); padding: var(--espacio-l);">
          No hay noticias publicadas recientemente.
        </div>
      `;
      return;
    }

    contenedorNoticiasRecientes.innerHTML = '';

    for (const noti of top3) {
      const card = document.createElement('article');
      card.className = `noticia-resumen-tarjeta ${noti.destacada ? 'noticia-resumen-tarjeta--destacada' : ''}`;

      const badgeDestacada = noti.destacada
        ? '<span class="insignia insignia--acento" style="font-size: 10px;">★ Destacada</span>'
        : '';
      const fechaTxt = fechaRelativa(noti.fechaPublicacion || noti.fecha);

      card.innerHTML = `
        <div class="pila" style="gap: var(--espacio-xs);">
          <div class="fila" style="justify-content: space-between; align-items: center; gap: var(--espacio-xs);">
            <span class="insignia insignia--secundario" style="font-size: 10px;">${escapar(noti.categoria || 'Institucional')}</span>
            ${badgeDestacada}
          </div>
          <h3 class="noticia-resumen-tarjeta__titulo">
            <a href="/paginas/noticia.html?id=${encodeURIComponent(noti.id)}">${escapar(noti.titulo)}</a>
          </h3>
          <p class="noticia-resumen-tarjeta__resumen">${escapar(noti.resumen || '')}</p>
        </div>

        <div class="fila" style="justify-content: space-between; align-items: center; font-size: 11px; color: var(--color-texto-suave); border-top: 1px solid var(--color-borde); padding-top: var(--espacio-xs); margin-top: var(--espacio-xs);">
          <time datetime="${noti.fechaPublicacion || noti.fecha}">${fechaTxt}</time>
          <a href="/paginas/noticia.html?id=${encodeURIComponent(noti.id)}" class="enlace-seccion" style="font-size: 11px;">
            Leer →
          </a>
        </div>
      `;

      contenedorNoticiasRecientes.appendChild(card);
    }
  } catch (error) {
    console.error('Error al cargar noticias en inicio:', error);
    contenedorNoticiasRecientes.innerHTML = `
      <div class="tarjeta" style="grid-column: 1 / -1; text-align: center; color: var(--color-error); padding: var(--espacio-l);">
        Error al cargar noticias recientes.
      </div>
    `;
  }
}

// Inicialización de la vista según el estado de la sesión
if (!usuario) {
  vistaPublica.style.display = 'block';
  vistaAutenticada.style.display = 'none';
} else {
  vistaPublica.style.display = 'none';
  vistaAutenticada.style.display = 'flex';

  saludoUsuario.textContent = `¡Hola, ${usuario.nombre}!`;
  rolUsuarioBadge.textContent = usuario.rol;

  // Accesos rápidos para docentes y administradores
  if (usuario.rol === 'docente' || usuario.rol === 'admin') {
    seccionAccesosDocente.style.display = 'block';
  }

  montarContinuarEstudio();

  cargando(true);
  try {
    await Promise.all([
      cargarMisAsignaturas(),
      cargarNoticiasRecientes()
    ]);
  } finally {
    cargando(false);
  }
}
