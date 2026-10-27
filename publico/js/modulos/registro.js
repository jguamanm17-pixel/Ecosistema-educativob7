// publico/js/modulos/registro.js · Controlador de la vista de registro
import { montarPlantilla } from '../nucleo/plantilla.js';
import * as sesion from '../nucleo/sesion.js';
import * as ui from '../nucleo/ui.js';

await montarPlantilla({ titulo: 'Registro' });

const formulario = document.getElementById('formulario-registro');
const campoNombre = document.getElementById('campo-nombre');
const campoApellido = document.getElementById('campo-apellido');
const campoCorreo = document.getElementById('campo-correo');
const campoClave = document.getElementById('campo-clave');
const campoConsentimiento = document.getElementById('campo-consentimiento');
const btnSubmit = document.getElementById('btn-submit');

const errorNombre = document.getElementById('error-nombre');
const errorApellido = document.getElementById('error-apellido');
const errorCorreo = document.getElementById('error-correo');
const errorClave = document.getElementById('error-clave');
const errorConsentimiento = document.getElementById('error-consentimiento');

function validarNombre() {
  const val = campoNombre.value.trim();
  if (!val) {
    errorNombre.textContent = 'El nombre es obligatorio.';
    return false;
  }
  errorNombre.textContent = '';
  return true;
}

function validarApellido() {
  const val = campoApellido.value.trim();
  if (!val) {
    errorApellido.textContent = 'El apellido es obligatorio.';
    return false;
  }
  errorApellido.textContent = '';
  return true;
}

function validarCorreo() {
  const val = campoCorreo.value.trim();
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!val) {
    errorCorreo.textContent = 'El correo electrónico es obligatorio.';
    return false;
  }
  if (!regex.test(val)) {
    errorCorreo.textContent = 'Ingresa un formato de correo válido.';
    return false;
  }
  errorCorreo.textContent = '';
  return true;
}

function validarClave() {
  const val = campoClave.value;
  if (!val) {
    errorClave.textContent = 'La contraseña es obligatoria.';
    return false;
  }
  if (val.length < 8) {
    errorClave.textContent = 'Debe tener al menos 8 caracteres.';
    return false;
  }
  if (!/[a-zA-Z]/.test(val) || !/\d/.test(val)) {
    errorClave.textContent = 'Debe combinar letras y números.';
    return false;
  }
  errorClave.textContent = '';
  return true;
}

function validarConsentimiento() {
  if (!campoConsentimiento.checked) {
    errorConsentimiento.textContent = 'Debes aceptar el aviso de privacidad para registrarte.';
    return false;
  }
  errorConsentimiento.textContent = '';
  return true;
}

// Validación en vivo
campoNombre.addEventListener('input', validarNombre);
campoApellido.addEventListener('input', validarApellido);
campoCorreo.addEventListener('input', validarCorreo);
campoClave.addEventListener('input', validarClave);
campoConsentimiento.addEventListener('change', validarConsentimiento);

formulario.addEventListener('submit', async (evento) => {
  evento.preventDefault();

  const esValido =
    validarNombre() &
    validarApellido() &
    validarCorreo() &
    validarClave() &
    validarConsentimiento();

  if (!esValido) {
    ui.aviso('Por favor completa todos los campos requeridos correctamente.', 'advertencia');
    return;
  }

  const datos = {
    nombre: campoNombre.value.trim(),
    apellido: campoApellido.value.trim(),
    correo: campoCorreo.value.trim(),
    clave: campoClave.value,
    consentimiento: true
  };

  btnSubmit.disabled = true;
  btnSubmit.textContent = 'Creando cuenta...';

  try {
    // 1. Registro en el servidor
    await sesion.registrar(datos);

    // 2. Inicio de sesión automático
    await sesion.iniciar(datos.correo, datos.clave);

    ui.aviso('¡Cuenta creada e inicio de sesión exitoso!', 'exito');

    setTimeout(() => {
      window.location.href = '/index.html';
    }, 600);
  } catch (error) {
    ui.aviso(error.message, 'error');
    btnSubmit.disabled = false;
    btnSubmit.textContent = 'Crear cuenta e ingresar';
  }
});
