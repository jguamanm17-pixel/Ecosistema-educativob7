// publico/js/modulos/editor-noticia.js · Editor y creador de noticias
import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import { aviso, cargando, escapar } from '../nucleo/ui.js';
import { parametro, formatoBasico } from '../nucleo/util.js';

await montarPlantilla({ titulo: 'Editor de noticia', roles: ['docente', 'admin'] });

const noticiaId = parametro('id');

const editorTitulo = document.getElementById('editor-titulo');
const formulario = document.getElementById('formulario-noticia');
const campoTitulo = document.getElementById('campo-titulo');
const campoCategoria = document.getElementById('campo-categoria');
const campoTema = document.getElementById('campo-tema');
const campoResumen = document.getElementById('campo-resumen');
const contadorResumen = document.getElementById('contador-resumen');
const campoCuerpo = document.getElementById('campo-cuerpo');
const campoImagen = document.getElementById('campo-imagen');
const inputArchivoImagen = document.getElementById('input-archivo-imagen');
const btnSubirImagen = document.getElementById('btn-subir-imagen');
const btnQuitarImagen = document.getElementById('btn-quitar-imagen');
const vistaMiniatura = document.getElementById('vista-miniatura');
const campoDestacada = document.getElementById('campo-destacada');
const campoEstado = document.getElementById('campo-estado');
const btnGuardar = document.getElementById('btn-guardar');
const btnTogglePrevia = document.getElementById('btn-toggle-previa');
const panelVistaPrevia = document.getElementById('panel-vista-previa');

// Elementos de la vista previa
const previaTitulo = document.getElementById('previa-titulo');
const previaCategoria = document.getElementById('previa-categoria');
const previaDestacadaBadge = document.getElementById('previa-destacada-badge');
const previaResumen = document.getElementById('previa-resumen');
const previaPortada = document.getElementById('previa-portada');
const previaTemaBadge = document.getElementById('previa-tema-badge');
const previaCuerpo = document.getElementById('previa-cuerpo');

let listaTemas = [];

// Actualiza en vivo la vista previa
function actualizarVistaPrevia() {
  const titulo = campoTitulo.value.trim() || 'Título de ejemplo';
  const categoria = campoCategoria.value || 'Institucional';
  const esDestacada = campoDestacada.checked;
  const resumen = campoResumen.value.trim() || 'El resumen de la noticia aparecerá aquí.';
  const imagenUrl = campoImagen.value;
  const cuerpoTexto = campoCuerpo.value.trim();
  const temaIdSeleccionado = campoTema.value;

  previaTitulo.textContent = titulo;
  previaCategoria.textContent = categoria;
  previaDestacadaBadge.style.display = esDestacada ? 'inline-block' : 'none';
  previaResumen.textContent = resumen;

  if (imagenUrl) {
    previaPortada.style.backgroundImage = `linear-gradient(rgba(0,0,0,0.3), rgba(0,0,0,0.6)), url('${imagenUrl}')`;
  } else {
    previaPortada.style.backgroundImage = '';
  }

  if (temaIdSeleccionado) {
    const temaEncontrado = listaTemas.find((t) => t.id === temaIdSeleccionado);
    if (temaEncontrado) {
      previaTemaBadge.style.display = 'block';
      previaTemaBadge.querySelector('span').textContent = `Tema: ${temaEncontrado.titulo}`;
    } else {
      previaTemaBadge.style.display = 'none';
    }
  } else {
    previaTemaBadge.style.display = 'none';
  }

  if (cuerpoTexto) {
    previaCuerpo.innerHTML = formatoBasico(cuerpoTexto);
  } else {
    previaCuerpo.innerHTML = '<em>El contenido formateado se mostrará aquí conforme escribas.</em>';
  }
}

// Carga lista de temas disponibles para relacionar
async function cargarTemas() {
  try {
    listaTemas = await api.listar('temas');
    for (const tema of listaTemas) {
      const opcion = document.createElement('option');
      opcion.value = tema.id;
      opcion.textContent = tema.titulo;
      campoTema.appendChild(opcion);
    }
  } catch (err) {
    console.debug('No se pudieron listar temas:', err.message);
  }
}

// Carga datos existentes si se está editando una noticia
async function cargarDatosEdicion() {
  if (!noticiaId) return;

  editorTitulo.textContent = 'Editar noticia';
  document.title = `Editar noticia · Ecosistema Educativo`;
  cargando(true);

  try {
    const noticia = await api.obtener('noticias', noticiaId);
    if (!noticia) throw new Error('Noticia no encontrada');

    campoTitulo.value = noticia.titulo || '';
    campoCategoria.value = noticia.categoria || 'Institucional';
    campoTema.value = noticia.temaId || '';
    campoResumen.value = noticia.resumen || '';
    campoCuerpo.value = noticia.cuerpo || '';
    campoDestacada.checked = Boolean(noticia.destacada);
    campoEstado.value = noticia.estado || 'borrador';

    if (noticia.imagen) {
      campoImagen.value = noticia.imagen;
      vistaMiniatura.innerHTML = `<img src="${noticia.imagen}" alt="Vista previa de miniatura">`;
      btnQuitarImagen.style.display = 'inline-block';
    }

    contadorResumen.textContent = `${campoResumen.value.length} / 200 caracteres`;
    actualizarVistaPrevia();
  } catch (error) {
    aviso(error.message || 'Error al cargar la noticia para edición', 'error');
  } finally {
    cargando(false);
  }
}

// Eventos de entrada para contador y vista previa
campoTitulo.addEventListener('input', actualizarVistaPrevia);
campoCategoria.addEventListener('change', actualizarVistaPrevia);
campoTema.addEventListener('change', actualizarVistaPrevia);
campoDestacada.addEventListener('change', actualizarVistaPrevia);

campoResumen.addEventListener('input', () => {
  contadorResumen.textContent = `${campoResumen.value.length} / 200 caracteres`;
  actualizarVistaPrevia();
});

campoCuerpo.addEventListener('input', actualizarVistaPrevia);

// Subida de imagen
btnSubirImagen.addEventListener('click', () => {
  inputArchivoImagen.click();
});

inputArchivoImagen.addEventListener('change', async () => {
  const archivo = inputArchivoImagen.files?.[0];
  if (!archivo) return;

  cargando(true);
  try {
    const resultado = await api.subir(archivo);
    if (resultado && resultado.url) {
      campoImagen.value = resultado.url;
      vistaMiniatura.innerHTML = `<img src="${resultado.url}" alt="Vista previa de portada">`;
      btnQuitarImagen.style.display = 'inline-block';
      actualizarVistaPrevia();
      aviso('Imagen subida con éxito', 'exito');
    }
  } catch (error) {
    aviso(error.message || 'Error al subir la imagen', 'error');
  } finally {
    cargando(false);
  }
});

btnQuitarImagen.addEventListener('click', () => {
  campoImagen.value = '';
  inputArchivoImagen.value = '';
  vistaMiniatura.innerHTML = `<span class="miniatura-placeholder">Sin imagen seleccionada</span>`;
  btnQuitarImagen.style.display = 'none';
  actualizarVistaPrevia();
});

// Alternar vista previa en pantallas pequeñas
btnTogglePrevia.addEventListener('click', () => {
  const visible = panelVistaPrevia.style.display !== 'none';
  panelVistaPrevia.style.display = visible ? 'none' : 'block';
  btnTogglePrevia.setAttribute('aria-pressed', String(!visible));
});

// Guardar noticia
formulario.addEventListener('submit', async (e) => {
  e.preventDefault();

  const titulo = campoTitulo.value.trim();
  const resumen = campoResumen.value.trim();
  const cuerpo = campoCuerpo.value.trim();

  if (!titulo) {
    aviso('El título es obligatorio', 'advertencia');
    campoTitulo.focus();
    return;
  }

  if (!resumen) {
    aviso('El resumen es obligatorio', 'advertencia');
    campoResumen.focus();
    return;
  }

  if (resumen.length > 200) {
    aviso('El resumen no puede tener más de 200 caracteres', 'advertencia');
    campoResumen.focus();
    return;
  }

  if (!cuerpo) {
    aviso('El cuerpo de la noticia no puede estar vacío', 'advertencia');
    campoCuerpo.focus();
    return;
  }

  const datos = {
    titulo,
    categoria: campoCategoria.value,
    temaId: campoTema.value || null,
    resumen,
    cuerpo,
    imagen: campoImagen.value || null,
    destacada: campoDestacada.checked,
    estado: campoEstado.value
  };

  btnGuardar.disabled = true;
  cargando(true);

  try {
    if (noticiaId) {
      await api.actualizar('noticias', noticiaId, datos);
      aviso('Noticia actualizada exitosamente', 'exito');
    } else {
      await api.crear('noticias', datos);
      aviso('Noticia creada exitosamente', 'exito');
    }

    // Redirige al catálogo de noticias tras guardar
    setTimeout(() => {
      window.location.href = '/paginas/noticias.html';
    }, 400);
  } catch (error) {
    aviso(error.message || 'Error al guardar la noticia', 'error');
    btnGuardar.disabled = false;
  } finally {
    cargando(false);
  }
});

// Inicialización
await cargarTemas();
await cargarDatosEdicion();
