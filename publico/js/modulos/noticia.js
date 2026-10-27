// publico/js/modulos/noticia.js · Detalle de noticia y registro de lectura
import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import { usuarioActual } from '../nucleo/sesion.js';
import { aviso, cargando, escapar } from '../nucleo/ui.js';
import { parametro, fechaLarga, formatoBasico } from '../nucleo/util.js';

await montarPlantilla({ titulo: 'Noticia', roles: ['sesion'] });

const noticiaId = parametro('id');
const usuario = usuarioActual();
const esDocenteOAdmin = usuario && (usuario.rol === 'docente' || usuario.rol === 'admin');

const noticiaTitulo = document.getElementById('noticia-titulo');
const noticiaCategoria = document.getElementById('noticia-categoria');
const noticiaBadgeDestacada = document.getElementById('noticia-badge-destacada');
const noticiaBadgeBorrador = document.getElementById('noticia-badge-borrador');
const noticiaFecha = document.getElementById('noticia-fecha');
const noticiaAutor = document.getElementById('noticia-autor');
const bloqueEditarNoticia = document.getElementById('bloque-editar-noticia');
const enlaceEditarNoticia = document.getElementById('enlace-editar-noticia');

const contenedorImagenPortada = document.getElementById('contenedor-imagen-portada');
const noticiaImagen = document.getElementById('noticia-imagen');
const noticiaResumen = document.getElementById('noticia-resumen');
const noticiaCuerpo = document.getElementById('noticia-cuerpo');

const noticiaTemaRelacionado = document.getElementById('noticia-tema-relacionado');
const temaRelacionadoTitulo = document.getElementById('tema-relacionado-titulo');
const enlaceTemaRelacionado = document.getElementById('enlace-tema-relacionado');

// Registra la lectura de la noticia para el usuario actual si aún no existe
async function registrarLecturaSiNoExiste(lecturas, id) {
  const yaLeida = (lecturas || []).some((l) => l.noticiaId === id);
  if (!yaLeida) {
    try {
      await api.crear('lecturas-noticias', { noticiaId: id });
    } catch (err) {
      // Si el gancho rechaza por duplicado concurrente, se ignora silenciosamente
      console.debug('Aviso al registrar lectura:', err.message);
    }
  }
}

async function cargarDetalleNoticia() {
  if (!noticiaId) {
    aviso('No se especificó la noticia a visualizar', 'advertencia');
    noticiaTitulo.textContent = 'Noticia no especificada';
    noticiaResumen.textContent = 'Por favor selecciona una noticia desde el catálogo general.';
    return;
  }

  cargando(true);
  try {
    const [noticia, lecturas, temas] = await Promise.all([
      api.obtener('noticias', noticiaId),
      api.listar('lecturas-noticias'),
      api.listar('temas')
    ]);

    if (!noticia) {
      throw new Error('La noticia solicitada no existe o no tienes permiso para verla');
    }

    // Registra la lectura de la noticia
    await registrarLecturaSiNoExiste(lecturas, noticia.id);

    // Renderizar datos en la vista
    document.title = `${noticia.titulo} · Ecosistema Educativo`;
    noticiaTitulo.textContent = noticia.titulo;
    noticiaCategoria.textContent = noticia.categoria || 'Institucional';

    if (noticia.destacada) {
      noticiaBadgeDestacada.style.display = 'inline-block';
    }
    if (noticia.estado === 'borrador') {
      noticiaBadgeBorrador.style.display = 'inline-block';
    }

    const fechaIso = noticia.fechaPublicacion || noticia.fecha;
    noticiaFecha.textContent = `Publicado: ${fechaLarga(fechaIso)}`;
    noticiaFecha.setAttribute('datetime', fechaIso);

    if (esDocenteOAdmin) {
      bloqueEditarNoticia.style.display = 'block';
      enlaceEditarNoticia.href = `/paginas/editor-noticia.html?id=${encodeURIComponent(noticia.id)}`;
    }

    if (noticia.imagen) {
      contenedorImagenPortada.style.display = 'block';
      noticiaImagen.src = noticia.imagen;
      noticiaImagen.alt = noticia.titulo;
    }

    noticiaResumen.textContent = noticia.resumen || '';
    noticiaCuerpo.innerHTML = formatoBasico(noticia.cuerpo || '');

    // Tema relacionado
    if (noticia.temaId) {
      const tema = (temas || []).find((t) => t.id === noticia.temaId);
      if (tema) {
        noticiaTemaRelacionado.style.display = 'block';
        temaRelacionadoTitulo.textContent = tema.titulo;
        enlaceTemaRelacionado.href = `/paginas/tema.html?id=${encodeURIComponent(tema.id)}`;
      }
    }
  } catch (error) {
    aviso(error.message || 'Error al cargar la noticia', 'error');
    noticiaTitulo.textContent = 'Error al cargar la noticia';
    noticiaResumen.textContent = error.message || 'No fue posible consultar los datos de la noticia solicitada.';
  } finally {
    cargando(false);
  }
}

await cargarDetalleNoticia();
