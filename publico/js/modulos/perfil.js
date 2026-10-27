// publico/js/modulos/perfil.js · Módulo de gestión del perfil de usuario
import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import { aviso, cargando } from '../nucleo/ui.js';
import { usuarioActual } from '../nucleo/sesion.js';

await montarPlantilla({ titulo: 'Mi perfil', roles: ['sesion'] });

// Elementos de la interfaz - Perfil
const formPerfil = document.getElementById('form-perfil');
const campoNombre = document.getElementById('campo-nombre');
const campoApellido = document.getElementById('campo-apellido');
const campoCorreo = document.getElementById('campo-correo');
const campoRol = document.getElementById('campo-rol');
const inputFoto = document.getElementById('input-foto');
const imgAvatar = document.getElementById('img-avatar');
const avatarIniciales = document.getElementById('avatar-iniciales');
const btnGuardarPerfil = document.getElementById('btn-guardar-perfil');
const errorNombre = document.getElementById('error-nombre');
const errorApellido = document.getElementById('error-apellido');
const errorFoto = document.getElementById('error-foto');

// Elementos de la interfaz - Clave
const formClave = document.getElementById('form-clave');
const campoClaveActual = document.getElementById('campo-clave-actual');
const campoClaveNueva = document.getElementById('campo-clave-nueva');
const campoClaveRepetir = document.getElementById('campo-clave-repetir');
const btnGuardarClave = document.getElementById('btn-guardar-clave');
const errorClaveActual = document.getElementById('error-clave-actual');
const errorClaveNueva = document.getElementById('error-clave-nueva');
const errorClaveRepetir = document.getElementById('error-clave-repetir');

let fotoSubidaUrl = null;

// Actualizar vista previa del avatar
function actualizarAvatar(foto, nombre, apellido) {
  if (foto) {
    imgAvatar.src = foto;
    imgAvatar.classList.remove('oculto');
    avatarIniciales.classList.add('oculto');
  } else {
    const n = (nombre || '')[0] || '';
    const a = (apellido || '')[0] || '';
    avatarIniciales.textContent = (n + a).toUpperCase() || '--';
    imgAvatar.classList.add('oculto');
    avatarIniciales.classList.remove('oculto');
  }
}

// Carga inicial de datos del usuario
async function cargarDatosPerfil() {
  const local = usuarioActual() || {};
  campoNombre.value = local.nombre || '';
  campoApellido.value = local.apellido || '';
  campoCorreo.value = local.correo || '';
  campoRol.value = local.rol || '';
  actualizarAvatar(local.foto, local.nombre, local.apellido);

  try {
    const remoto = await api.llamar('GET', '/api/auth/yo');
    campoNombre.value = remoto.nombre || '';
    campoApellido.value = remoto.apellido || '';
    campoCorreo.value = remoto.correo || '';
    campoRol.value = remoto.rol || '';
    actualizarAvatar(remoto.foto, remoto.nombre, remoto.apellido);

    // Sincronizar sessionStorage con los datos remotos
    const actualizado = { ...local, ...remoto };
    sessionStorage.setItem('usuario', JSON.stringify(actualizado));
  } catch (error) {
    // Si falla la consulta remota se mantienen los datos de la sesión local
    console.warn('No se pudo sincronizar el perfil con el servidor:', error.message);
  }
}

await cargarDatosPerfil();

// Subida de imagen de foto de perfil
inputFoto.addEventListener('change', async (evento) => {
  const archivo = evento.target.files?.[0];
  errorFoto.textContent = '';
  if (!archivo) return;

  const tipos = ['image/jpeg', 'image/png', 'image/webp'];
  if (!tipos.includes(archivo.type)) {
    errorFoto.textContent = 'Solo se permiten imágenes JPG, PNG o WEBP';
    inputFoto.value = '';
    return;
  }

  if (archivo.size > 2 * 1024 * 1024) {
    errorFoto.textContent = 'La imagen supera el límite de 2 MB';
    inputFoto.value = '';
    return;
  }

  cargando(true);
  try {
    const res = await api.subir(archivo);
    fotoSubidaUrl = res.url;
    actualizarAvatar(res.url, campoNombre.value, campoApellido.value);
    aviso('Imagen subida correctamente. Guarda los cambios para aplicar.', 'info');
  } catch (error) {
    errorFoto.textContent = error.message || 'Error al subir la imagen';
    aviso(error.message || 'Error al subir la imagen', 'error');
  } finally {
    cargando(false);
  }
});

// Validación en vivo para datos de perfil
campoNombre.addEventListener('input', () => {
  errorNombre.textContent = campoNombre.value.trim() ? '' : 'El nombre es obligatorio';
});

campoApellido.addEventListener('input', () => {
  errorApellido.textContent = campoApellido.value.trim() ? '' : 'El apellido es obligatorio';
});

// Guardar cambios del perfil
formPerfil.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const nombre = campoNombre.value.trim();
  const apellido = campoApellido.value.trim();

  let tieneError = false;
  if (!nombre) {
    errorNombre.textContent = 'El nombre es obligatorio';
    tieneError = true;
  }
  if (!apellido) {
    errorApellido.textContent = 'El apellido es obligatorio';
    tieneError = true;
  }

  if (tieneError) return;

  btnGuardarPerfil.disabled = true;
  cargando(true);

  try {
    const cambios = { nombre, apellido };
    if (fotoSubidaUrl !== null) {
      cambios.foto = fotoSubidaUrl;
    }

    const actualizado = await api.llamar('PUT', '/api/auth/perfil', cambios);

    // Actualizar usuario en sessionStorage
    const local = usuarioActual() || {};
    const usuarioFusionado = { ...local, ...actualizado };
    sessionStorage.setItem('usuario', JSON.stringify(usuarioFusionado));

    actualizarAvatar(usuarioFusionado.foto, usuarioFusionado.nombre, usuarioFusionado.apellido);
    aviso('Perfil actualizado correctamente', 'exito');
  } catch (error) {
    aviso(error.message || 'Error al actualizar el perfil', 'error');
  } finally {
    btnGuardarPerfil.disabled = false;
    cargando(false);
  }
});

// Validaciones en vivo para cambio de contraseña
function esClaveValida(clave) {
  return typeof clave === 'string' && clave.length >= 8 && /[a-zA-Z]/.test(clave) && /\d/.test(clave);
}

campoClaveActual.addEventListener('input', () => {
  errorClaveActual.textContent = campoClaveActual.value ? '' : 'Ingresa tu contraseña actual';
});

campoClaveNueva.addEventListener('input', () => {
  const v = campoClaveNueva.value;
  if (!v) {
    errorClaveNueva.textContent = 'Ingresa la nueva contraseña';
  } else if (!esClaveValida(v)) {
    errorClaveNueva.textContent = 'Debe tener al menos 8 caracteres, con letras y números';
  } else {
    errorClaveNueva.textContent = '';
  }

  if (campoClaveRepetir.value && campoClaveRepetir.value !== v) {
    errorClaveRepetir.textContent = 'Las contraseñas no coinciden';
  } else if (campoClaveRepetir.value) {
    errorClaveRepetir.textContent = '';
  }
});

campoClaveRepetir.addEventListener('input', () => {
  if (campoClaveRepetir.value !== campoClaveNueva.value) {
    errorClaveRepetir.textContent = 'Las contraseñas no coinciden';
  } else {
    errorClaveRepetir.textContent = '';
  }
});

// Guardar nueva contraseña
formClave.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const actual = campoClaveActual.value;
  const nueva = campoClaveNueva.value;
  const repetir = campoClaveRepetir.value;

  let tieneError = false;
  if (!actual) {
    errorClaveActual.textContent = 'Ingresa tu contraseña actual';
    tieneError = true;
  }
  if (!esClaveValida(nueva)) {
    errorClaveNueva.textContent = 'Debe tener al menos 8 caracteres, con letras y números';
    tieneError = true;
  }
  if (nueva !== repetir) {
    errorClaveRepetir.textContent = 'Las contraseñas no coinciden';
    tieneError = true;
  }

  if (tieneError) return;

  btnGuardarClave.disabled = true;
  cargando(true);

  try {
    await api.llamar('POST', '/api/auth/clave', { actual, nueva });
    aviso('Contraseña actualizada con éxito', 'exito');
    formClave.reset();
  } catch (error) {
    aviso(error.message || 'Error al cambiar la contraseña', 'error');
  } finally {
    btnGuardarClave.disabled = false;
    cargando(false);
  }
});
