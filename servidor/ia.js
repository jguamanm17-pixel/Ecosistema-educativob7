// servidor/ia.js · Motor de tareas con inteligencia artificial y preparadores
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import * as almacen from './almacen.js';

// Generador de respaldo educativo cuando no se ha configurado API key de IA en .env
function generarRespaldoEducativo(tarea, datosPlantilla) {
  if (tarea === 'generar-preguntas') {
    const { tema, nivelBloom, cantidad, contenido } = datosPlantilla;
    const n = Math.min(Math.max(Number(cantidad) || 5, 5), 15);
    const preguntas = [];

    const tipos = ['opcion', 'vf', 'completar'];

    for (let i = 1; i <= n; i++) {
      const tipo = tipos[(i - 1) % tipos.length];

      if (tipo === 'opcion') {
        preguntas.push({
          tipo: 'opcion',
          enunciado: `Respecto a "${tema}", según el nivel ${nivelBloom}, ¿cuál es la medida primordial identificada? (Pregunta ${i})`,
          opciones: [
            `Aplicar rigurosamente los protocolos técnicos y equipos de protección acordes a ${tema}`,
            `Omitir la señalización si la jornada de trabajo es breve`,
            `Delegar la seguridad únicamente en personal sin capacitación previa`,
            `Priorizar la rapidez de entrega sobre los estándares preventivos`
          ],
          correcta: 0,
          retroalimentacion: `Es correcta porque la aplicación estricta de protocolos técnicos garantiza la integridad de los trabajadores.`
        });
      } else if (tipo === 'vf') {
        preguntas.push({
          tipo: 'vf',
          enunciado: `En el ámbito de "${tema}", la inspección y mantenimiento continuo de los sistemas de protección es de carácter obligatorio.`,
          opciones: ['Verdadero', 'Falso'],
          correcta: true,
          retroalimentacion: `Es Verdadero porque la normativa exige inspecciones periódicas previas a cada labor en obra.`
        });
      } else {
        preguntas.push({
          tipo: 'completar',
          enunciado: `Para garantizar la seguridad en "${tema}", todo trabajador debe contar obligatoriamente con ____ homologados antes de iniciar labores.`,
          opciones: [],
          correcta: 'equipos de protección',
          retroalimentacion: `La respuesta correcta es "equipos de protección", indispensables para mitigar riesgos en la construcción.`
        });
      }
    }

    return preguntas;
  }

  if (tarea === 'generar-glosario') {
    const { tema, cantidad } = datosPlantilla;
    const n = Number(cantidad) || 12;
    const lista = [];
    for (let i = 1; i <= n; i++) {
      lista.push({
        termino: `Termino${i}`,
        definicion: `Definición técnica clara y concisa sobre ${tema} para el aprendizaje universitario.`,
        pista: `Concepto clave número ${i} de la materia.`,
        retroalimentacion: `Este término representa un fundamento imprescindible en la prevención y protección.`
      });
    }
    return lista;
  }

  if (tarea === 'tutor') {
    const { asignatura, tema, pregunta, contenido } = datosPlantilla;
    const p = (pregunta || '').toLowerCase();

    // Verificación de consulta ajena
    const esConsultaAjena = p.includes('clima') || p.includes('chiste') || p.includes('futbol') || p.includes('musica') || p.includes('receta') || p.includes('pelicula');
    if (esConsultaAjena) {
      return `Como tutor socrático de "${asignatura}", mi acompañamiento está enfocado estrictamente en nuestros contenidos curriculares. ¿Te parece si retomamos los temas de "${tema}" para resolver tus dudas académicas?`;
    }

    if (p.includes('arnes') || p.includes('altura') || p.includes('caida')) {
      return `Excelente punto de partida sobre la seguridad en alturas. Reflexionemos juntos: ¿cuál es la diferencia crucial entre un sistema que previene la caída y uno que detiene al trabajador una vez que cae? ¿Por qué la normativa técnica exige priorizar el primero?`;
    }

    if (p.includes('epi') || p.includes('colectiv') || p.includes('casco') || p.includes('proteccion')) {
      return `Muy buena pregunta sobre los sistemas de protección en ${asignatura}. Si en una obra existe un riesgo potencial, ¿por qué crees que la normativa establece proteger primero a todo el grupo (EPC) antes de delegar la seguridad en el equipo individual (EPI)?`;
    }

    if (p.includes('excavacion') || p.includes('zanja') || p.includes('talud')) {
      return `Una situación crítica en obra civil. Antes de que el personal ingrese a una zanja o excavación, ¿qué factores del terreno (como tipo de suelo, humedad o peso de maquinaria cercana) consideras determinantes para decidir si se requiere entibación?`;
    }

    return `¡Muy buena iniciativa para razonar sobre "${tema}"! Para guiarte en deducir la solución: según lo que has revisado en ${asignatura}, ¿cuál crees que es el factor primordial o regla de oro aplicable en esta situación? Comparte tu hipótesis inicial.`;
  }

  return { mensaje: 'Tarea completada exitosamente' };
}

/**
 * Obtiene la configuración actual de IA priorizando datos/config/ajustes.json y variables de entorno
 * @returns {Promise<{ claveIa: string, modelo: string, proveedor: string }>}
 */
export async function obtenerConfiguracionIa() {
  const ajustes = await almacen.leerConfig('ajustes');
  const claveIa = (ajustes?.iaClave || process.env.IA_CLAVE || '').trim();
  const modelo = (ajustes?.iaModelo || process.env.IA_MODELO || 'gemini-1.5-flash').trim();
  const proveedor = (ajustes?.iaProveedor || process.env.IA_PROVEEDOR || 'gemini').trim();
  return { claveIa, modelo, proveedor };
}

/**
 * Guarda la configuración de IA en datos/config/ajustes.json y actualiza el entorno en caliente
 * @param {Object} nuevaConfig
 * @returns {Promise<Object>}
 */
export async function guardarConfiguracionIa({ claveIa, modelo, proveedor }) {
  const ajustes = await almacen.leerConfig('ajustes');

  if (claveIa !== undefined) {
    ajustes.iaClave = String(claveIa).trim();
    process.env.IA_CLAVE = ajustes.iaClave;
  }
  if (modelo !== undefined) {
    ajustes.iaModelo = String(modelo).trim();
    process.env.IA_MODELO = ajustes.iaModelo;
  }
  if (proveedor !== undefined) {
    ajustes.iaProveedor = String(proveedor).trim();
    process.env.IA_PROVEEDOR = ajustes.iaProveedor;
  }

  // Guardar en datos/config/ajustes.json
  const rutaAjustes = path.resolve('datos', 'config', 'ajustes.json');
  await fs.writeFile(rutaAjustes, JSON.stringify(ajustes, null, 2), 'utf-8');

  // Actualizar también .env para persistencia entre reinicios
  try {
    const rutaEnv = path.resolve('.env');
    let contenidoEnv = await fs.readFile(rutaEnv, 'utf-8').catch(() => '');
    const lineas = contenidoEnv.split(/\r?\n/);
    const clavesVistas = new Set();
    const nuevasLineas = lineas.map((linea) => {
      const idx = linea.indexOf('=');
      if (idx > 0) {
        const k = linea.slice(0, idx).trim();
        if (k === 'IA_CLAVE' && claveIa !== undefined) {
          clavesVistas.add('IA_CLAVE');
          return `IA_CLAVE=${ajustes.iaClave}`;
        }
        if (k === 'IA_MODELO' && modelo !== undefined) {
          clavesVistas.add('IA_MODELO');
          return `IA_MODELO=${ajustes.iaModelo}`;
        }
        if (k === 'IA_PROVEEDOR' && proveedor !== undefined) {
          clavesVistas.add('IA_PROVEEDOR');
          return `IA_PROVEEDOR=${ajustes.iaProveedor}`;
        }
      }
      return linea;
    });

    if (claveIa !== undefined && !clavesVistas.has('IA_CLAVE')) {
      nuevasLineas.push(`IA_CLAVE=${ajustes.iaClave}`);
    }
    if (modelo !== undefined && !clavesVistas.has('IA_MODELO')) {
      nuevasLineas.push(`IA_MODELO=${ajustes.iaModelo}`);
    }
    if (proveedor !== undefined && !clavesVistas.has('IA_PROVEEDOR')) {
      nuevasLineas.push(`IA_PROVEEDOR=${ajustes.iaProveedor}`);
    }

    await fs.writeFile(rutaEnv, nuevasLineas.filter(Boolean).join('\n') + '\n', 'utf-8');
  } catch (err) {
    console.warn('Aviso al actualizar .env:', err.message);
  }

  return {
    claveEnmascarada: ajustes.iaClave ? `${ajustes.iaClave.slice(0, 8)}...` : '',
    modelo: ajustes.iaModelo,
    proveedor: ajustes.iaProveedor
  };
}

/**
 * Prueba la conexión con el servicio de Gemini usando la clave y modelo dados o configurados
 * @param {string} [clave]
 * @param {string} [modelo]
 * @returns {Promise<{ ok: boolean, mensaje: string, datos?: any }>}
 */
export async function probarConexionIa(clave, modelo) {
  const config = await obtenerConfiguracionIa();
  const claveUsar = (clave !== undefined ? clave : config.claveIa).trim();
  const modeloUsar = (modelo !== undefined ? modelo : config.modelo).trim() || 'gemini-1.5-flash';

  if (!claveUsar) {
    return {
      ok: false,
      mensaje: 'No hay ninguna API key configurada. La plataforma está usando el generador de respaldo formativo local.'
    };
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modeloUsar}:generateContent?key=${encodeURIComponent(claveUsar)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': claveUsar
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: 'Responde únicamente con la palabra OK' }] }]
      })
    });

    if (!res.ok) {
      const errorTexto = await res.text();
      let detalle = `HTTP ${res.status}: ${res.statusText}`;
      try {
        const jsonErr = JSON.parse(errorTexto);
        if (jsonErr?.error?.message) {
          detalle = jsonErr.error.message;
        }
      } catch {}
      return {
        ok: false,
        mensaje: `Error al conectar con Gemini (${modeloUsar}): ${detalle}`
      };
    }

    const respuestaJson = await res.json();
    const texto = respuestaJson?.candidates?.[0]?.content?.parts?.[0]?.text || 'OK';
    return {
      ok: true,
      mensaje: `Conexión exitosa con Google Gemini (${modeloUsar}). Respuesta de prueba: "${texto.trim()}"`
    };
  } catch (err) {
    return {
      ok: false,
      mensaje: `Fallo de red o servicio al conectar con Gemini: ${err.message}`
    };
  }
}

/**
 * Ejecuta una tarea de IA preparando los datos, procesando el prompt y llamando al proveedor
 * @param {string} tarea - Nombre de la tarea (ej: 'generar-preguntas')
 * @param {Object} datos - Parámetros recibidos del cliente
 * @param {Object} usuario - Usuario autenticado
 * @param {Object} [opciones={ formato: 'json' }]
 * @returns {Promise<any>}
 */
export async function ejecutarTarea(tarea, datos, usuario, opciones = { formato: 'json' }) {
  if (!usuario) {
    throw Object.assign(new Error('Acceso no autorizado'), { estado: 401 });
  }

  // 1. Cargar preparador
  const rutaPreparador = path.resolve('servidor', 'preparadores', `${tarea}.js`);
  let datosPlantilla = datos;

  try {
    const moduloPreparador = await import(pathToFileURL(rutaPreparador).href);
    if (typeof moduloPreparador.default === 'function') {
      datosPlantilla = await moduloPreparador.default(datos, usuario);
    }
  } catch (err) {
    if (err.code !== 'ENOENT') {
      throw err;
    }
  }

  // 2. Cargar prompt
  const rutaPrompt = path.resolve('servidor', 'prompts', `${tarea}.txt`);
  let contenidoPrompt = '';

  try {
    contenidoPrompt = await fs.readFile(rutaPrompt, 'utf8');
  } catch (err) {
    throw Object.assign(
      new Error(`No existe plantilla de prompt para la tarea "${tarea}"`),
      { estado: 404 }
    );
  }

  // Sustituir variables {{clave}}
  for (const [clave, valor] of Object.entries(datosPlantilla)) {
    contenidoPrompt = contenidoPrompt.replaceAll(`{{${clave}}}`, String(valor));
  }

  let resultado = null;
  const { claveIa, modelo } = await obtenerConfiguracionIa();

  // Si existe clave de IA configurada, consultar API externa de Gemini
  if (claveIa && claveIa.trim()) {
    try {
      const [sistema, usuarioMensaje] = contenidoPrompt.split('### USUARIO');
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo || 'gemini-1.5-flash'}:generateContent?key=${encodeURIComponent(claveIa.trim())}`;

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': claveIa.trim()
        },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: (sistema || '').trim() }] },
          contents: [{ role: 'user', parts: [{ text: (usuarioMensaje || contenidoPrompt).trim() }] }],
          generationConfig: {
            response_mime_type: opciones.formato === 'json' ? 'application/json' : 'text/plain'
          }
        })
      });

      if (!res.ok) {
        const errorTexto = await res.text();
        throw new Error(`Error de API Gemini: ${res.status} ${res.statusText} - ${errorTexto}`);
      }

      const datosRes = await res.json();
      const textoSalida = datosRes?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      resultado = opciones.formato === 'json' ? JSON.parse(textoSalida) : textoSalida;
    } catch (err) {
      console.warn(`Aviso: Falló proveedor externo de IA (${err.message}). Utilizando generador de respaldo formativo.`);
      resultado = generarRespaldoEducativo(tarea, datosPlantilla);
    }
  } else {
    // Modo local / educativo sin credenciales externas
    resultado = generarRespaldoEducativo(tarea, datosPlantilla);
  }

  // Registrar consumo en datos/consumo-ia.jsonl
  try {
    await almacen.anexarLinea('consumo-ia.jsonl', {
      usuarioId: usuario.id,
      tarea,
      entrada: datos,
      salida: Array.isArray(resultado) ? `[${resultado.length} elementos]` : typeof resultado,
      ok: true,
      fecha: new Date().toISOString()
    });
  } catch (logErr) {
    console.debug('Aviso al registrar consumo IA:', logErr.message);
  }

  return resultado;
}

export default {
  obtenerConfiguracionIa,
  guardarConfiguracionIa,
  probarConexionIa,
  ejecutarTarea
};
