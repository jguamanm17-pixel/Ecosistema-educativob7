// publico/js/modulos/ingreso.js · Controlador de la vista de inicio de sesión
import { montarPlantilla } from '../nucleo/plantilla.js';
import * as sesion from '../nucleo/sesion.js';
import * as ui from '../nucleo/ui.js';

await montarPlantilla({ titulo: 'Ingreso' });

const formulario = document.getElementById('formulario-ingreso');
const campoCorreo = document.getElementById('campo-correo');
const campoClave = document.getElementById('campo-clave');
const btnSubmit = document.getElementById('btn-submit');
const errorCorreo = document.getElementById('error-correo');
const errorClave = document.getElementById('error-clave');

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
  errorClave.textContent = '';
  return true;
}

// Validación en vivo
campoCorreo.addEventListener('input', validarCorreo);
campoClave.addEventListener('input', validarClave);

formulario.addEventListener('submit', async (evento) => {
  evento.preventDefault();

  const esValido = validarCorreo() & validarClave();
  if (!esValido) {
    ui.aviso('Por favor completa las credenciales requeridas.', 'advertencia');
    return;
  }

  const correo = campoCorreo.value.trim();
  const clave = campoClave.value;

  btnSubmit.disabled = true;
  btnSubmit.textContent = 'Iniciando sesión...';

  try {
    const res = await sesion.iniciar(correo, clave);
    ui.aviso(`¡Bienvenido/a, ${res.usuario.nombre}!`, 'exito');

    setTimeout(() => {
      window.location.href = '/index.html';
    }, 500);
  } catch (error) {
    ui.aviso(error.message, 'error');
    btnSubmit.disabled = false;
    btnSubmit.textContent = 'Ingresar';
  }
});
