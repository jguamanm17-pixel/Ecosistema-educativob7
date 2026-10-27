// publico/js/modulos/noticias.js · Catálogo de noticias institucional con filtros y paginación
import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import { usuarioActual } from '../nucleo/sesion.js';
import { aviso, cargando, escapar } from '../nucleo/ui.js';
import { fechaRelativa, normalizar } from '../nucleo/util.js';

await montarPlantilla({ titulo: 'Noticias', roles: ['sesion'] });

const usuario = usuarioActual();
const esDocenteOAdmin = usuario && (usuario.rol === 'docente' || usuario.rol === 'admin');

const bloqueAccionDocente = document.getElementById('bloque-accion-docente');
const filtroCategoria = document.getElementById('filtro-categoria');
const filtroTema = document.getElementById('filtro-tema');
const filtroBusqueda = document.getElementById('filtro-busqueda');
const contadorNoticias = document.getElementById('contador-noticias');
const rejillaNoticias = document.getElementById('rejilla-noticias');
const paginacionNoticias = document.getElementById('paginacion-noticias');

if (esDocenteOAdmin && bloqueAccionDocente) {
  bloqueAccionDocente.style.display = 'block';
}

const POR_PAGINA = 9;
let paginaActual = 1;
let todasNoticias = [];
let setLeidas = new Set();
let mapaTemas = new Map();

// Carga temas para el filtro desplegable
function poblarFiltroTemas(temas) {
  mapaTemas.clear();
  filtroTema.innerHTML = '<option value="">Todos los temas</option>';
  for (const tema of temas) {
    mapaTemas.set(tema.id, tema.titulo);
    const opcion = document.createElement('option');
    opcion.value = tema.id;
    opcion.textContent = tema.titulo;
    filtroTema.appendChild(opcion);
  }
}

// Ordena noticias: destacadas primero y luego por fecha descendente
function ordenarNoticias(lista) {
  return [...lista].sort((a, b) => {
    // 1. Destacadas primero
    if (Boolean(a.destacada) !== Boolean(b.destacada)) {
      return a.destacada ? -1 : 1;
    }
    // 2. Fecha más reciente primero
    const fechaA = new Date(a.fechaPublicacion || a.fecha || 0).getTime();
    const fechaB = new Date(b.fechaPublicacion || b.fecha || 0).getTime();
    return fechaB - fechaA;
  });
}

// Aplica los filtros de búsqueda, categoría y tema
function obtenerNoticiasFiltradas() {
  const cat = filtroCategoria.value;
  const tema = filtroTema.value;
  const busqueda = normalizar(filtroBusqueda.value.trim());

  return todasNoticias.filter((n) => {
    if (cat && n.categoria !== cat) return false;
    if (tema && n.temaId !== tema) return false;
    if (busqueda) {
      const matchTitulo = normalizar(n.titulo || '').includes(busqueda);
      const matchResumen = normalizar(n.resumen || '').includes(busqueda);
      const matchCuerpo = normalizar(n.cuerpo || '').includes(busqueda);
      if (!matchTitulo && !matchResumen && !matchCuerpo) return false;
    }
    return true;
  });
}

// Renderiza los botones de paginación
function renderizarPaginacion(totalItems) {
  const totalPaginas = Math.ceil(totalItems / POR_PAGINA);

  if (totalPaginas <= 1) {
    paginacionNoticias.style.display = 'none';
    paginacionNoticias.innerHTML = '';
    return;
  }

  paginacionNoticias.style.display = 'flex';
  paginacionNoticias.innerHTML = '';

  // Botón Anterior
  const btnAnt = document.createElement('button');
  btnAnt.type = 'button';
  btnAnt.className = 'paginacion__boton';
  btnAnt.textContent = '« Ant';
  btnAnt.disabled = paginaActual === 1;
  btnAnt.addEventListener('click', () => {
    if (paginaActual > 1) {
      paginaActual--;
      renderizarListado();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });
  paginacionNoticias.appendChild(btnAnt);

  // Páginas numeradas
  for (let p = 1; p <= totalPaginas; p++) {
    const btnNum = document.createElement('button');
    btnNum.type = 'button';
    btnNum.className = `paginacion__boton ${p === paginaActual ? 'paginacion__boton--activo' : ''}`;
    btnNum.textContent = String(p);
    btnNum.setAttribute('aria-label', `Página ${p}`);
    btnNum.addEventListener('click', () => {
      paginaActual = p;
      renderizarListado();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    paginacionNoticias.appendChild(btnNum);
  }

  // Botón Siguiente
  const btnSig = document.createElement('button');
  btnSig.type = 'button';
  btnSig.className = 'paginacion__boton';
  btnSig.textContent = 'Sig »';
  btnSig.disabled = paginaActual === totalPaginas;
  btnSig.addEventListener('click', () => {
    if (paginaActual < totalPaginas) {
      paginaActual++;
      renderizarListado();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });
  paginacionNoticias.appendChild(btnSig);
}

// Renderiza las tarjetas de la página actual
function renderizarListado() {
  const filtradas = obtenerNoticiasFiltradas();
  const total = filtradas.length;

  contadorNoticias.textContent = `${total} ${total === 1 ? 'noticia encontrada' : 'noticias encontradas'}`;

  if (total === 0) {
    rejillaNoticias.innerHTML = `
      <div class="vacio" style="grid-column: 1 / -1; width: 100%;">
        <h3>No hay noticias para mostrar</h3>
        <p>No se encontraron publicaciones con los filtros seleccionados.</p>
        ${
          esDocenteOAdmin
            ? `<a href="/paginas/editor-noticia.html" class="btn btn--primario">+ Publicar primera noticia</a>`
            : ''
        }
      </div>
    `;
    paginacionNoticias.style.display = 'none';
    return;
  }

  // Paginación en memoria
  const inicio = (paginaActual - 1) * POR_PAGINA;
  const fin = inicio + POR_PAGINA;
  const paginaItems = filtradas.slice(inicio, fin);

  rejillaNoticias.innerHTML = '';

  for (const item of paginaItems) {
    const esLeida = setLeidas.has(item.id);
    const esBorrador = item.estado === 'borrador';
    const fechaTexto = fechaRelativa(item.fechaPublicacion || item.fecha);
    const temaTitulo = item.temaId ? mapaTemas.get(item.temaId) : null;

    const article = document.createElement('article');
    article.className = `noticia-tarjeta ${item.destacada ? 'noticia-tarjeta--destacada' : ''}`;
    article.setAttribute('role', 'listitem');

    // Portada
    let estiloPortada = '';
    let clasePortada = 'noticia-tarjeta__portada';
    if (item.imagen) {
      estiloPortada = `style="background-image: linear-gradient(rgba(0,0,0,0.2), rgba(0,0,0,0.6)), url('${escapar(item.imagen)}');"`;
    } else {
      clasePortada += ' noticia-tarjeta__portada--sin-imagen';
    }

    const badgeNuevo = !esLeida
      ? `<span class="insignia insignia--exito" style="font-weight: var(--peso-negrita);">Nuevo</span>`
      : '';
    const badgeDestacada = item.destacada
      ? `<span class="insignia insignia--acento">★ Destacada</span>`
      : '';
    const badgeBorrador = esBorrador
      ? `<span class="insignia insignia--advertencia">Borrador</span>`
      : '';

    const botonEditar = esDocenteOAdmin
      ? `<a href="/paginas/editor-noticia.html?id=${encodeURIComponent(item.id)}" class="btn btn--secundario btn--pequeno" aria-label="Editar noticia ${escapar(item.titulo)}">Editar</a>`
      : '';

    article.innerHTML = `
      <div class="${clasePortada}" ${estiloPortada}>
        <span class="insignia insignia--secundario">${escapar(item.categoria || 'Institucional')}</span>
        <div class="fila" style="gap: var(--espacio-xs);">
          ${badgeNuevo}
          ${badgeDestacada}
          ${badgeBorrador}
        </div>
      </div>
      <div class="noticia-tarjeta__cuerpo">
        <h2 class="noticia-tarjeta__titulo">
          <a href="/paginas/noticia.html?id=${encodeURIComponent(item.id)}">${escapar(item.titulo)}</a>
        </h2>
        <p class="noticia-tarjeta__resumen">${escapar(item.resumen || '')}</p>
        ${
          temaTitulo
            ? `<span style="font-size: var(--tamano-xs); color: var(--color-info); margin-bottom: var(--espacio-xs);">
                📚 Tema: ${escapar(temaTitulo)}
               </span>`
            : ''
        }
        <div class="noticia-tarjeta__pie">
          <time datetime="${item.fechaPublicacion || item.fecha}">${fechaTexto}</time>
          <div class="noticia-tarjeta__acciones">
            ${botonEditar}
            <a href="/paginas/noticia.html?id=${encodeURIComponent(item.id)}" class="btn btn--primario btn--pequeno">
              Leer más →
            </a>
          </div>
        </div>
      </div>
    `;

    rejillaNoticias.appendChild(article);
  }

  renderizarPaginacion(total);
}

// Carga inicial de datos
async function cargarDatos() {
  cargando(true);
  try {
    const [noticias, lecturas, temas] = await Promise.all([
      api.listar('noticias'),
      api.listar('lecturas-noticias'),
      api.listar('temas')
    ]);

    setLeidas = new Set((lecturas || []).map((l) => l.noticiaId));
    poblarFiltroTemas(temas || []);
    todasNoticias = ordenarNoticias(noticias || []);

    paginaActual = 1;
    renderizarListado();
  } catch (error) {
    aviso(error.message || 'Error al cargar las noticias', 'error');
    rejillaNoticias.innerHTML = `
      <div class="tarjeta" style="grid-column: 1 / -1; text-align: center; color: var(--color-error); padding: var(--espacio-xl);">
        ${escapar(error.message || 'Error de conexión')}
      </div>
    `;
  } finally {
    cargando(false);
  }
}

// Eventos de filtros
filtroCategoria.addEventListener('change', () => {
  paginaActual = 1;
  renderizarListado();
});

filtroTema.addEventListener('change', () => {
  paginaActual = 1;
  renderizarListado();
});

filtroBusqueda.addEventListener('input', () => {
  paginaActual = 1;
  renderizarListado();
});

await cargarDatos();
