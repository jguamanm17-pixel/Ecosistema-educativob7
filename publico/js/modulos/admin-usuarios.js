// publico/js/modulos/admin-usuarios.js · Gestión administrativa de usuarios
import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import { aviso, confirmar, modal, cargando, escapar } from '../nucleo/ui.js';
import { normalizar } from '../nucleo/util.js';

await montarPlantilla({ titulo: 'Usuarios', roles: ['admin'] });

const buscarUsuario = document.getElementById('buscar-usuario');
const filtroRol = document.getElementById('filtro-rol');
const tbodyUsuarios = document.getElementById('tbody-usuarios');

let listaUsuarios = [];

// Cargar la lista completa de usuarios desde la API
async function cargarUsuarios() {
  cargando(true);
  try {
    listaUsuarios = await api.listar('usuarios');
    renderizarTabla();
  } catch (error) {
    aviso(error.message || 'Error al cargar usuarios', 'error');
    tbodyUsuarios.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; padding: var(--espacio-l); color: var(--color-error);">
          ${escapar(error.message || 'No se pudo cargar la lista de usuarios')}
        </td>
      </tr>
    `;
  } finally {
    cargando(false);
  }
}

// Renderizar las filas de la tabla según los filtros activos
function renderizarTabla() {
  const termino = normalizar(buscarUsuario.value.trim());
  const rolFiltro = filtroRol.value;

  const filtrados = listaUsuarios.filter((u) => {
    if (rolFiltro !== 'todos' && u.rol !== rolFiltro) return false;
    if (!termino) return true;
    const cadenaBusqueda = normalizar(`${u.nombre || ''} ${u.apellido || ''} ${u.correo || ''}`);
    return cadenaBusqueda.includes(termino);
  });

  if (filtrados.length === 0) {
    tbodyUsuarios.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; padding: var(--espacio-l); color: var(--color-texto-suave);">
          No se encontraron usuarios que coincidan con la búsqueda.
        </td>
      </tr>
    `;
    return;
  }

  tbodyUsuarios.innerHTML = '';

  for (const usuario of filtrados) {
    const tr = document.createElement('tr');

    // 1. Celda Usuario
    const tdUsuario = document.createElement('td');
    const iniciales = ((usuario.nombre?.[0] || '') + (usuario.apellido?.[0] || '')).toUpperCase() || '--';
    const avatarInner = usuario.foto
      ? `<img src="${escapar(usuario.foto)}" alt="" loading="lazy">`
      : escapar(iniciales);

    tdUsuario.innerHTML = `
      <div class="admin-usuario-celda">
        <div class="admin-usuario-avatar" aria-hidden="true">${avatarInner}</div>
        <div class="admin-usuario-info">
          <span class="admin-usuario-nombre">${escapar(usuario.nombre)} ${escapar(usuario.apellido)}</span>
          <span class="admin-usuario-id">ID: ${escapar(usuario.id)}</span>
        </div>
      </div>
    `;
    tr.appendChild(tdUsuario);

    // 2. Celda Correo
    const tdCorreo = document.createElement('td');
    tdCorreo.textContent = usuario.correo;
    tr.appendChild(tdCorreo);

    // 3. Celda Rol (selector interactivo)
    const tdRol = document.createElement('td');
    const selectRol = document.createElement('select');
    selectRol.className = 'admin-select-rol';
    selectRol.setAttribute('aria-label', `Rol de ${usuario.nombre} ${usuario.apellido}`);
    selectRol.innerHTML = `
      <option value="estudiante" ${usuario.rol === 'estudiante' ? 'selected' : ''}>Estudiante</option>
      <option value="docente" ${usuario.rol === 'docente' ? 'selected' : ''}>Docente</option>
      <option value="admin" ${usuario.rol === 'admin' ? 'selected' : ''}>Administrador</option>
    `;

    selectRol.addEventListener('change', async () => {
      const nuevoRol = selectRol.value;
      cargando(true);
      try {
        await api.actualizar('usuarios', usuario.id, { rol: nuevoRol });
        usuario.rol = nuevoRol;
        aviso(`Rol de ${usuario.nombre} actualizado a ${nuevoRol}`, 'exito');
      } catch (error) {
        selectRol.value = usuario.rol;
        aviso(error.message || 'Error al actualizar el rol', 'error');
      } finally {
        cargando(false);
      }
    });
    tdRol.appendChild(selectRol);
    tr.appendChild(tdRol);

    // 4. Celda Activo (casilla interactiva)
    const tdActivo = document.createElement('td');
    tdActivo.style.textAlign = 'center';

    const checkActivo = document.createElement('input');
    checkActivo.type = 'checkbox';
    checkActivo.className = 'admin-checkbox-activo';
    checkActivo.checked = usuario.activo !== false;
    checkActivo.setAttribute('aria-label', `Cuenta activa de ${usuario.nombre} ${usuario.apellido}`);

    checkActivo.addEventListener('change', async () => {
      const nuevoEstado = checkActivo.checked;
      cargando(true);
      try {
        await api.actualizar('usuarios', usuario.id, { activo: nuevoEstado });
        usuario.activo = nuevoEstado;
        aviso(`Cuenta de ${usuario.nombre} ${nuevoEstado ? 'activada' : 'desactivada'}`, 'exito');
      } catch (error) {
        checkActivo.checked = !nuevoEstado;
        aviso(error.message || 'Error al actualizar estado', 'error');
      } finally {
        cargando(false);
      }
    });
    tdActivo.appendChild(checkActivo);
    tr.appendChild(tdActivo);

    // 5. Celda Acciones (Restablecer clave)
    const tdAcciones = document.createElement('td');
    tdAcciones.style.textAlign = 'right';

    const btnRestablecer = document.createElement('button');
    btnRestablecer.type = 'button';
    btnRestablecer.className = 'btn btn--secundario btn--pequeno';
    btnRestablecer.textContent = 'Restablecer clave';

    btnRestablecer.addEventListener('click', async () => {
      const confirmado = await confirmar(
        `¿Deseas restablecer la contraseña de ${usuario.nombre} ${usuario.apellido}?`
      );
      if (!confirmado) return;

      cargando(true);
      try {
        const respuesta = await api.llamar('POST', `/api/admin/usuarios/${usuario.id}/restablecer`);
        cargando(false);

        const contenedorModal = document.createElement('div');
        contenedorModal.className = 'pila';
        contenedorModal.style.gap = 'var(--espacio-s)';
        contenedorModal.innerHTML = `
          <p>Se ha generado una nueva contraseña temporal para <strong>${escapar(usuario.nombre)} ${escapar(usuario.apellido)}</strong>:</p>
          <div class="fila" style="justify-content: center; align-items: center; gap: var(--espacio-s); margin: var(--espacio-m) 0;">
            <code style="font-size: var(--tamano-xl); font-weight: var(--peso-negrita); background: var(--color-fondo); padding: var(--espacio-s) var(--espacio-m); border-radius: var(--radio-s); border: 1.5px dashed var(--color-acento); letter-spacing: 2px;">${escapar(respuesta.claveTemporal)}</code>
            <button type="button" id="btn-copiar-clave-temporal" class="btn btn--secundario btn--pequeno">Copiar</button>
          </div>
          <p style="font-size: var(--tamano-xs); color: var(--color-texto-suave);">Copia y entrega esta clave al usuario. Podrá cambiarla luego desde su perfil.</p>
        `;

        const btnCopiar = contenedorModal.querySelector('#btn-copiar-clave-temporal');
        btnCopiar.addEventListener('click', async () => {
          try {
            await navigator.clipboard.writeText(respuesta.claveTemporal);
            btnCopiar.textContent = '¡Copiado!';
            aviso('Clave temporal copiada al portapapeles', 'exito');
          } catch {
            aviso('No se pudo copiar automáticamente. Copia el texto manualmente.', 'error');
          }
        });

        await modal({
          titulo: 'Contraseña restablecida',
          contenido: contenedorModal,
          acciones: [{ texto: 'Aceptar', valor: true, clase: 'btn--primario' }]
        });
      } catch (error) {
        cargando(false);
        aviso(error.message || 'Error al restablecer la contraseña', 'error');
      }
    });

    tdAcciones.appendChild(btnRestablecer);
    tr.appendChild(tdAcciones);

    tbodyUsuarios.appendChild(tr);
  }
}

// Eventos de filtrado en vivo
buscarUsuario.addEventListener('input', renderizarTabla);
filtroRol.addEventListener('change', renderizarTabla);

await cargarUsuarios();
