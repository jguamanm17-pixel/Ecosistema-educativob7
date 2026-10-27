// publico/js/nucleo/plantilla.js · Montaje de la plantilla común institucional
import { MENU } from './menu.js';
import * as api from './api.js';
import { usuarioActual, exigirRol, cerrar } from './sesion.js';
import { registrarEvento } from './bitacora.js';
import { aviso } from './ui.js';

export const NOMBRE = 'Ecosistema Educativo';

/**
 * Monta el encabezado, navegación lateral y pie común en la página
 * @param {Object} opciones
 * @param {string} opciones.titulo - Título de la página
 * @param {string[]} [opciones.roles] - Roles permitidos para la vista
 */
export async function montarPlantilla({ titulo, roles = [] }) {
  // 1. Exigir rol si se especifica
  if (roles && roles.length > 0) {
    exigirRol(roles);
  }

  // 2. Verificar avisos pendientes en sesión (ej. redirecciones por permisos)
  if (typeof sessionStorage !== 'undefined') {
    const rawAviso = sessionStorage.getItem('aviso_pendiente');
    if (rawAviso) {
      sessionStorage.removeItem('aviso_pendiente');
      try {
        const { texto, tipo } = JSON.parse(rawAviso);
        aviso(texto, tipo || 'info');
      } catch {
        // En caso de texto plano
        aviso(rawAviso, 'info');
      }
    }
  }

  // 3. Título del documento
  if (typeof document !== 'undefined') {
    document.title = `${titulo} · ${NOMBRE}`;
  }

  const contenedorPlantilla = document.getElementById('plantilla');
  const contenedorContenido = document.getElementById('contenido');
  if (!contenedorPlantilla) return;

  const rutaActual = typeof window !== 'undefined' ? window.location.pathname : '';
  const usuario = usuarioActual();

  // 4. Registro de auditoría si hay sesión activa (sin esperar la promesa)
  if (usuario && typeof window !== 'undefined') {
    registrarEvento('pagina', window.location.pathname);
  }

  // 5. Bloque de autenticación en el encabezado
  let bloqueAuthHtml = '';
  if (usuario) {
    const avatarHtml = usuario.foto
      ? `<img src="${usuario.foto}" alt="" style="width: 26px; height: 26px; border-radius: var(--radio-completo); object-fit: cover; border: 1.5px solid var(--color-acento);">`
      : '';
    bloqueAuthHtml = `
      <div class="fila" style="gap: var(--espacio-s);">
        <a href="/paginas/perfil.html" style="color: var(--color-texto-inverso); font-size: var(--tamano-s); display: inline-flex; align-items: center; gap: var(--espacio-xs);">
          ${avatarHtml}
          <span>${usuario.nombre} ${usuario.apellido}</span>
          <span class="insignia insignia--acento" style="text-transform: capitalize;">${usuario.rol}</span>
        </a>
        <button type="button" id="btn-cerrar-sesion" class="btn btn--secundario btn--pequeno" aria-label="Cerrar sesión">Salir</button>
      </div>
    `;
  } else {
    bloqueAuthHtml = `
      <div class="fila" style="gap: var(--espacio-s);">
        <a href="/paginas/ingreso.html" class="btn btn--secundario btn--pequeno">Ingresar</a>
        <a href="/paginas/registro.html" class="btn btn--primario btn--pequeno" style="border: 1px solid var(--color-acento);">Registrarse</a>
      </div>
    `;
  }

  // 6. Encabezado institucional
  const encabezadoHtml = `
    <header class="encabezado">
      <div class="contenedor fila" style="justify-content: space-between;">
        <div class="fila" style="gap: var(--espacio-m);">
          <button type="button" id="btn-menu-movil" class="btn btn--secundario btn--pequeno btn-menu-movil" aria-controls="menu-lateral" aria-expanded="false" aria-label="Abrir menú de navegación">
            <span aria-hidden="true">☰</span>
            <span class="sr-only">Menú</span>
          </button>
          <div class="pila" style="gap: 0;">
            <a href="/index.html" style="font-weight: var(--peso-extranegrita); font-size: var(--tamano-l); color: var(--color-texto-inverso);">${NOMBRE}</a>
            <span style="font-size: var(--tamano-xs); color: #FFA366;">${titulo}</span>
          </div>
        </div>
        ${bloqueAuthHtml}
      </div>
    </header>
  `;

  // 7. Filtrado del menú por roles (publico = todos, sesion = con sesión)
  const menuFiltrado = MENU.filter((item) => {
    if (!item.roles || item.roles.includes('publico')) return true;
    if (item.roles.includes('sesion') && usuario) return true;
    if (usuario && item.roles.includes(usuario.rol)) return true;
    return false;
  });

  const itemsMenuHtml = menuFiltrado
    .map((item) => {
      const esActivo =
        rutaActual === item.href ||
        (rutaActual === '/' && item.href === '/index.html') ||
        (item.href !== '/index.html' && rutaActual.endsWith(item.href));

      const claseActivo = esActivo ? ' class="activo"' : '';
      const ariaCurrent = esActivo ? ' aria-current="page"' : '';

      return `<a href="${item.href}"${claseActivo}${ariaCurrent}>${item.texto}</a>`;
    })
    .join('');

  // 8. Inyección en el DOM
  contenedorPlantilla.innerHTML = encabezadoHtml;

  const layoutPrincipal = document.createElement('div');
  layoutPrincipal.className = 'diseno-principal contenedor';

  const barraLateral = document.createElement('aside');
  barraLateral.className = 'barra-lateral';
  barraLateral.innerHTML = `
    <nav class="menu" id="menu-lateral" aria-label="Navegación principal">
      ${itemsMenuHtml}
    </nav>
  `;

  layoutPrincipal.appendChild(barraLateral);

  if (contenedorContenido && contenedorContenido.parentElement !== layoutPrincipal) {
    layoutPrincipal.appendChild(contenedorContenido);
  }

  contenedorPlantilla.insertAdjacentElement('afterend', layoutPrincipal);

  // 9. Interacción móvil y botón de cierre de sesión
  const btnMenu = document.getElementById('btn-menu-movil');
  if (btnMenu) {
    btnMenu.addEventListener('click', () => {
      const abierto = barraLateral.classList.toggle('menu--abierto');
      btnMenu.setAttribute('aria-expanded', String(abierto));
      btnMenu.setAttribute('aria-label', abierto ? 'Cerrar menú de navegación' : 'Abrir menú de navegación');
    });
  }

  const btnSalir = document.getElementById('btn-cerrar-sesion');
  if (btnSalir) {
    btnSalir.addEventListener('click', async () => {
      await cerrar();
    });
  }

  // 10. Contador de noticias sin leer junto a "Noticias"
  if (usuario) {
    actualizarContadorNoticias().catch((err) => {
      console.debug('Aviso al obtener noticias sin leer:', err.message);
    });
  }

  // 11. Pie de página al final del body
  let pie = document.querySelector('footer.pie');
  if (!pie) {
    pie = document.createElement('footer');
    pie.className = 'pie';
    const anio = new Date().getFullYear();
    pie.innerHTML = `
      <div class="contenedor fila" style="justify-content: space-between;">
        <p>© ${anio} ${NOMBRE} · Plataforma educativa de competencias digitales.</p>
        <p><small style="color: #BCD0DC;">Universidad Estatal de Milagro</small></p>
      </div>
    `;
    document.body.appendChild(pie);
  }
}

/**
 * Consulta noticias publicadas y lecturas del usuario para mostrar el número de noticias sin leer
 */
async function actualizarContadorNoticias() {
  const enlaceNoticias = document.querySelector('#menu-lateral a[href="/paginas/noticias.html"]');
  if (!enlaceNoticias) return;

  const [noticias, lecturas] = await Promise.all([
    api.listar('noticias'),
    api.listar('lecturas-noticias')
  ]);

  const publicadas = (noticias || []).filter((n) => n.estado === 'publicado');
  const leidasSet = new Set((lecturas || []).map((l) => l.noticiaId));
  const sinLeer = publicadas.filter((n) => !leidasSet.has(n.id)).length;

  if (sinLeer > 0) {
    let insignia = enlaceNoticias.querySelector('.insignia-noticias');
    if (!insignia) {
      insignia = document.createElement('span');
      insignia.className = 'insignia insignia--acento insignia-noticias';
      insignia.style.marginLeft = 'auto';
      insignia.style.fontSize = 'var(--tamano-xs)';
      insignia.style.padding = '1px 6px';
      enlaceNoticias.appendChild(insignia);
    }
    insignia.textContent = String(sinLeer);
    insignia.setAttribute('aria-label', `${sinLeer} noticias sin leer`);
  }
}

