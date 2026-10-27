// publico/js/modulos/editor-cancion.js · Editor de canciones educativas
import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import { aviso, cargando, escapar } from '../nucleo/ui.js';
import { parametro } from '../nucleo/util.js';

await montarPlantilla({ titulo: 'Editor de canción', roles: ['docente', 'admin'] });

const cancionId = parametro('id');

const editorTitulo = document.getElementById('editor-titulo');
const formulario = document.getElementById('formulario-cancion');
const campoTitulo = document.getElementById('campo-titulo');
const campoTema = document.getElementById('campo-tema');
const campoAudio = document.getElementById('campo-audio');
const inputArchivoAudio = document.getElementById('input-archivo-audio');
const btnSubirAudio = document.getElementById('btn-subir-audio');
const audioNombreArchivo = document.getElementById('audio-nombre-archivo');
const audioPrevia = document.getElementById('audio-previa');
const campoLetra = document.getElementById('campo-letra');
const campoLrc = document.getElementById('campo-lrc');
const btnEjemploLrc = document.getElementById('btn-ejemplo-lrc');
const campoAutoria = document.getElementById('campo-autoria');
const campoLicenciaTipo = document.getElementById('campo-licencia-tipo');
const campoLicenciaOtra = document.getElementById('campo-licencia-otra');
const btnGuardar = document.getElementById('btn-guardar');

// Alternar campo de descripción si la licencia es "Otra"
campoLicenciaTipo.addEventListener('change', () => {
  if (campoLicenciaTipo.value === 'Otra') {
    campoLicenciaOtra.style.display = 'block';
    campoLicenciaOtra.required = true;
    campoLicenciaOtra.focus();
  } else {
    campoLicenciaOtra.style.display = 'none';
    campoLicenciaOtra.required = false;
  }
});

// Plantilla rápida de LRC para facilitar la edición
btnEjemploLrc.addEventListener('click', () => {
  if (campoLrc.value.trim() && !confirm('¿Deseas reemplazar el contenido actual con la plantilla de ejemplo LRC?')) {
    return;
  }
  campoLrc.value = `[00:05.00] Introducción musical
[00:12.30] Primera estrofa: Seguridad en cada paso
[00:18.50] Casco firme, botas listas
[00:24.00] Línea de vida anclada al punto exacto
[00:30.20] Coro: ¡Prevenir es construir el futuro!`;
});

// Carga los temas disponibles según las asignaturas a las que tiene acceso el usuario
async function cargarTemas() {
  try {
    const [asignaturas, unidades, temas] = await Promise.all([
      api.listar('asignaturas'),
      api.listar('unidades'),
      api.listar('temas')
    ]);

    const mapaAsignaturas = new Map(asignaturas.map((a) => [a.id, a.nombre]));
    const mapaUnidades = new Map(unidades.map((u) => [u.id, u.asignaturaId]));

    campoTema.innerHTML = '<option value="">Selecciona un tema académico...</option>';

    for (const tema of temas) {
      const asignaturaId = mapaUnidades.get(tema.unidadId);
      const nombreAsignatura = mapaAsignaturas.get(asignaturaId) || 'Asignatura';
      const opcion = document.createElement('option');
      opcion.value = tema.id;
      opcion.textContent = `${nombreAsignatura} » ${tema.titulo}`;
      campoTema.appendChild(opcion);
    }
  } catch (error) {
    console.debug('Error al listar temas para el editor:', error.message);
  }
}

// Subida de audio MP3
btnSubirAudio.addEventListener('click', () => {
  inputArchivoAudio.click();
});

inputArchivoAudio.addEventListener('change', async () => {
  const archivo = inputArchivoAudio.files?.[0];
  if (!archivo) return;

  btnSubirAudio.disabled = true;
  cargando(true);

  try {
    const resultado = await api.subir(archivo);
    if (resultado && resultado.url) {
      campoAudio.value = resultado.url;
      audioNombreArchivo.textContent = `Archivo cargado: ${archivo.name}`;
      audioPrevia.src = resultado.url;
      audioPrevia.style.display = 'block';
      aviso('Archivo de audio MP3 subido con éxito', 'exito');
    }
  } catch (error) {
    aviso(error.message || 'Error al subir el archivo de audio', 'error');
  } finally {
    btnSubirAudio.disabled = false;
    cargando(false);
  }
});

// Carga datos para edición si existe ?id=
async function cargarDatosEdicion() {
  if (!cancionId) return;

  editorTitulo.textContent = 'Editar canción educativa';
  document.title = 'Editar canción · Ecosistema Educativo';
  cargando(true);

  try {
    const cancion = await api.obtener('canciones', cancionId);
    if (!cancion) throw new Error('Canción no encontrada');

    campoTitulo.value = cancion.titulo || '';
    campoTema.value = cancion.temaId || '';
    campoAudio.value = cancion.audio || '';
    campoLetra.value = cancion.letra || '';
    campoLrc.value = cancion.lrc || '';
    campoAutoria.value = cancion.autoria || '';

    if (cancion.audio) {
      audioNombreArchivo.textContent = `Audio: ${cancion.audio.split('/').pop()}`;
      audioPrevia.src = cancion.audio;
      audioPrevia.style.display = 'block';
    }

    const lic = cancion.licencia || 'Propia';
    if (['Propia', 'CC BY', 'CC BY-SA'].includes(lic)) {
      campoLicenciaTipo.value = lic;
      campoLicenciaOtra.style.display = 'none';
    } else {
      campoLicenciaTipo.value = 'Otra';
      campoLicenciaOtra.style.display = 'block';
      campoLicenciaOtra.value = lic;
    }
  } catch (error) {
    aviso(error.message || 'Error al cargar la canción', 'error');
  } finally {
    cargando(false);
  }
}

// Envío del formulario
formulario.addEventListener('submit', async (e) => {
  e.preventDefault();

  const titulo = campoTitulo.value.trim();
  const temaId = campoTema.value;
  const audio = campoAudio.value.trim();
  const letra = campoLetra.value.trim();
  const lrc = campoLrc.value.trim() || null;
  const autoria = campoAutoria.value.trim();

  let licencia = campoLicenciaTipo.value;
  if (licencia === 'Otra') {
    licencia = campoLicenciaOtra.value.trim() || 'Otra licencia especificada por el autor';
  }

  if (!titulo) {
    aviso('El título de la canción es obligatorio', 'advertencia');
    campoTitulo.focus();
    return;
  }

  if (!temaId) {
    aviso('Debes asociar la canción a un tema académico', 'advertencia');
    campoTema.focus();
    return;
  }

  if (!audio) {
    aviso('Debes subir un archivo de audio MP3', 'advertencia');
    return;
  }

  if (!letra) {
    aviso('La letra de la canción es obligatoria', 'advertencia');
    campoLetra.focus();
    return;
  }

  if (!autoria) {
    aviso('La autoría es obligatoria', 'advertencia');
    campoAutoria.focus();
    return;
  }

  const datos = {
    titulo,
    temaId,
    audio,
    letra,
    lrc,
    autoria,
    licencia
  };

  btnGuardar.disabled = true;
  cargando(true);

  try {
    if (cancionId) {
      await api.actualizar('canciones', cancionId, datos);
      aviso('Canción actualizada exitosamente', 'exito');
    } else {
      await api.crear('canciones', datos);
      aviso('Canción creada exitosamente', 'exito');
    }

    setTimeout(() => {
      window.location.href = `/paginas/canciones.html?temaId=${encodeURIComponent(temaId)}`;
    }, 400);
  } catch (error) {
    aviso(error.message || 'Error al guardar la canción', 'error');
    btnGuardar.disabled = false;
  } finally {
    cargando(false);
  }
});

await cargarTemas();
await cargarDatosEdicion();
