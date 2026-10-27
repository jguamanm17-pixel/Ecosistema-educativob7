// publico/js/modulos/admin-ia.js · Controlador de administración de Inteligencia Artificial
import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';

let inputClave = null;
let inputModelo = null;
let ayudaClave = null;
let badgeEstado = null;
let textoEstado = null;
let cajaResultado = null;
let iconoResultado = null;
let mensajeResultado = null;

async function iniciar() {
  await montarPlantilla({ titulo: 'Configuración de Inteligencia Artificial', roles: ['admin'] });

  inputClave = document.getElementById('cfg-ia-clave');
  inputModelo = document.getElementById('cfg-ia-modelo');
  ayudaClave = document.getElementById('ayuda-clave-actual');
  badgeEstado = document.getElementById('badge-estado-ia');
  textoEstado = document.getElementById('texto-estado-ia');
  cajaResultado = document.getElementById('caja-resultado-prueba');
  iconoResultado = document.getElementById('icono-resultado');
  mensajeResultado = document.getElementById('mensaje-resultado');

  conectarEventos();
  await cargarConfiguracion();
}

function conectarEventos() {
  // Alternar ver clave
  document.getElementById('btn-toggle-clave')?.addEventListener('click', () => {
    inputClave.type = inputClave.type === 'password' ? 'text' : 'password';
  });

  // Probar conexión
  document.getElementById('btn-probar-conexion')?.addEventListener('click', async () => {
    await probarConexion();
  });

  // Guardar formulario
  document.getElementById('form-config-ia')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await guardarConfiguracion();
  });
}

/**
 * Consulta la configuración actual del servidor
 */
async function cargarConfiguracion() {
  try {
    ui.cargando(true);
    const data = await api.llamar('GET', '/api/ia/config');

    inputClave.value = data.claveIa || '';
    inputModelo.value = data.modelo || 'gemini-3.8-flash';

    if (data.claveEnmascarada) {
      ayudaClave.innerHTML = `Clave guardada activa: <strong>${ui.escapar(data.claveEnmascarada)}</strong>.`;
      badgeEstado.className = 'ia-estado-badge conectado';
      textoEstado.textContent = `API Key activa (${data.modelo})`;
    } else {
      ayudaClave.textContent = 'Sin clave configurada. La plataforma utilizará el generador de respaldo formativo local.';
      badgeEstado.className = 'ia-estado-badge desconectado';
      textoEstado.textContent = 'Modo Respaldo Local (Sin clave)';
    }
  } catch (err) {
    ui.aviso(`Error al cargar configuración: ${err.message}`, 'error');
  } finally {
    ui.cargando(false);
  }
}

/**
 * Prueba la conexión con Google Gemini en vivo
 */
async function probarConexion() {
  const claveIa = inputClave.value.trim();
  const modelo = inputModelo.value.trim() || 'gemini-3.8-flash';

  cajaResultado.hidden = false;
  cajaResultado.style.backgroundColor = 'var(--color-info-fondo)';
  cajaResultado.style.border = '1px solid var(--color-info)';
  iconoResultado.textContent = '⏳';
  mensajeResultado.innerHTML = `Conectando con Google Gemini usando el modelo <strong>${ui.escapar(modelo)}</strong>...`;

  try {
    ui.cargando(true);
    const res = await api.llamar('POST', '/api/ia/probar-conexion', { claveIa, modelo });

    if (res.ok) {
      cajaResultado.style.backgroundColor = 'var(--color-exito-fondo)';
      cajaResultado.style.border = '1px solid var(--color-exito)';
      iconoResultado.textContent = '✅';
      mensajeResultado.innerHTML = `<strong>¡Conexión Exitosa!</strong><br>${ui.escapar(res.mensaje)}`;
      ui.aviso('Conexión con Google Gemini verificada', 'exito');
    } else {
      cajaResultado.style.backgroundColor = 'var(--color-error-fondo)';
      cajaResultado.style.border = '1px solid var(--color-error)';
      iconoResultado.textContent = '❌';
      mensajeResultado.innerHTML = `<strong>Error de conexión reportado por Google:</strong><br>${ui.escapar(res.mensaje)}`;
      ui.aviso('No se pudo verificar la conexión', 'error');
    }
  } catch (err) {
    cajaResultado.style.backgroundColor = 'var(--color-error-fondo)';
    cajaResultado.style.border = '1px solid var(--color-error)';
    iconoResultado.textContent = '❌';
    mensajeResultado.innerHTML = `<strong>Error de solicitud:</strong><br>${ui.escapar(err.message)}`;
    ui.aviso(`Fallo al probar conexión: ${err.message}`, 'error');
  } finally {
    ui.cargando(false);
  }
}

/**
 * Guarda la nueva clave y modelo en el servidor
 */
async function guardarConfiguracion() {
  const claveIa = inputClave.value.trim();
  const modelo = inputModelo.value.trim() || 'gemini-3.8-flash';

  try {
    ui.cargando(true);
    const res = await api.llamar('PUT', '/api/ia/config', {
      claveIa,
      modelo,
      proveedor: 'gemini'
    });

    ui.aviso(res.mensaje || 'Configuración guardada exitosamente', 'exito');
    await cargarConfiguracion();
  } catch (err) {
    ui.aviso(`Error al guardar configuración: ${err.message}`, 'error');
  } finally {
    ui.cargando(false);
  }
}

iniciar();
