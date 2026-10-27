// publico/js/nucleo/pdf.js · Generación y descarga accesible de diplomas en PDF
import * as api from './api.js';
import * as ui from './ui.js';
import { usuarioActual } from './sesion.js';

const NOMBRES_BLOOM = {
  1: 'Recordar',
  2: 'Comprender',
  3: 'Aplicar',
  4: 'Analizar',
  5: 'Evaluar'
};

/**
 * Carga la librería jsPDF por CDN si no se encuentra disponible en window
 * @returns {Promise<any>}
 */
async function cargarJsPdf() {
  if (typeof window !== 'undefined' && window.jspdf && window.jspdf.jsPDF) {
    return window.jspdf.jsPDF;
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    script.onload = () => {
      if (window.jspdf && window.jspdf.jsPDF) {
        resolve(window.jspdf.jsPDF);
      } else {
        reject(new Error('No se pudo inicializar jsPDF'));
      }
    };
    script.onerror = () => reject(new Error('Fallo al descargar jsPDF desde CDN'));
    document.head.appendChild(script);
  });
}

/**
 * Genera y descarga el diploma de nivel o cumplimiento en formato PDF
 * @param {Object} opciones
 * @param {'cumplimiento'|'nivel-quiz'} [opciones.tipo='nivel-quiz']
 * @param {string} opciones.temaId
 * @param {number} [opciones.nivel=1]
 * @returns {Promise<{ codigo: string }>}
 */
export async function generarDiploma({ tipo = 'nivel-quiz', temaId, nivel = 1 }) {
  const usuario = usuarioActual();
  if (!usuario) {
    throw new Error('Debes iniciar sesión para descargar tu diploma');
  }

  ui.cargando(true);
  try {
    const tema = await api.obtener('temas', temaId);
    const jsPDFClass = await cargarJsPdf();

    const codigo = `DIP-${tipo === 'nivel-quiz' ? `NQ${nivel}` : 'CUM'}-${Date.now().toString(36).toUpperCase()}`;
    const fecha = new Date().toLocaleDateString('es-EC', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const doc = new jsPDFClass({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    // Marco exterior azul institucional UNEMI
    doc.setDrawColor(0, 46, 69);
    doc.setLineWidth(3);
    doc.rect(10, 10, 277, 190);

    // Marco interior dorado / naranja acento
    doc.setDrawColor(255, 105, 0);
    doc.setLineWidth(1);
    doc.rect(14, 14, 269, 182);

    // Encabezado
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(0, 46, 69);
    doc.text('ECOSISTEMA EDUCATIVO DIGITAL', 148.5, 35, { align: 'center' });

    doc.setFontSize(14);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(85, 104, 119);
    doc.text('UNIVERSIDAD ESTATAL DE MILAGRO', 148.5, 43, { align: 'center' });

    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 105, 0);
    doc.text('DIPLOMA DE RECONOCIMIENTO', 148.5, 62, { align: 'center' });

    doc.setFontSize(13);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(24, 45, 62);
    doc.text('Se otorga el presente reconocimiento a:', 148.5, 78, { align: 'center' });

    // Nombre del estudiante
    const nombreCompleto = `${usuario.nombre || ''} ${usuario.apellido || ''}`.trim() || 'Estudiante';
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 46, 69);
    doc.text(nombreCompleto.toUpperCase(), 148.5, 92, { align: 'center' });

    // Línea bajo el nombre
    doc.setDrawColor(223, 231, 236);
    doc.setLineWidth(0.5);
    doc.line(60, 96, 237, 96);

    // Texto de acreditación
    const nombreBloom = NOMBRES_BLOOM[nivel] || `Nivel ${nivel}`;
    doc.setFontSize(13);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(24, 45, 62);

    const textoMotivo = tipo === 'nivel-quiz'
      ? `Por haber aprobado con éxito el Nivel ${nivel} (${nombreBloom}) en la evaluación del tema:`
      : `Por haber completado satisfactoriamente los contenidos y actividades del tema:`;
    doc.text(textoMotivo, 148.5, 110, { align: 'center' });

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 46, 69);
    doc.text(`"${tema.titulo}"`, 148.5, 122, { align: 'center' });

    // Firmas y sellos
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(85, 104, 119);

    doc.line(40, 160, 110, 160);
    doc.text('Dirección de Docencia y Carrera', 75, 166, { align: 'center' });

    doc.line(187, 160, 257, 160);
    doc.text('Coordinación de Evaluación Digital', 222, 166, { align: 'center' });

    // Pie con fecha y código de verificación
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(`Emitido el: ${fecha}`, 20, 185);
    doc.text(`Código de verificación: ${codigo}`, 277, 185, { align: 'right' });

    // Descarga del documento
    const nombreArchivo = `diploma-nivel-${nivel}-${tema.id}.pdf`;
    doc.save(nombreArchivo);

    ui.aviso(`Diploma descargado con éxito (${codigo})`, 'exito');
    return { codigo };
  } catch (err) {
    ui.aviso(`Error al generar diploma: ${err.message}`, 'error');
    throw err;
  } finally {
    ui.cargando(false);
  }
}

export default {
  generarDiploma
};
