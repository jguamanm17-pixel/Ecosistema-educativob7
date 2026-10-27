// publico/js/nucleo/api.js · Cliente HTTP para la API del ecosistema
/**
 * Realiza una solicitud HTTP a la API gestionando cabeceras, sesión y errores
 * @param {string} metodo - 'GET', 'POST', 'PUT', 'DELETE', etc.
 * @param {string} ruta - Ruta de la API (ej: '/api/usuarios' o 'usuarios')
 * @param {any} [cuerpo=null] - Datos a enviar (objeto, FormData o null)
 * @returns {Promise<any>}
 */
export async function llamar(metodo, ruta, cuerpo = null) {
  const url = ruta.startsWith('/') ? ruta : `/api/${ruta}`;
  const opciones = {
    method: metodo.toUpperCase(),
    headers: {}
  };

  const token = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('token') : null;
  if (token) {
    opciones.headers['Authorization'] = `Bearer ${token}`;
  }

  if (cuerpo !== null && cuerpo !== undefined) {
    if (typeof FormData !== 'undefined' && cuerpo instanceof FormData) {
      opciones.body = cuerpo;
      // El navegador asigna el Content-Type multipart con boundary automáticamente
    } else {
      opciones.headers['Content-Type'] = 'application/json';
      opciones.body = JSON.stringify(cuerpo);
    }
  }

  const respuesta = await fetch(url, opciones);

  // Manejo de sesión no autorizada (401)
  if (respuesta.status === 401) {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('usuario');
    }
    if (typeof window !== 'undefined' && window.location) {
      const rutaActual = window.location.pathname || '';
      const enAuth = rutaActual.includes('ingreso.html') || rutaActual.includes('registro.html');
      if (!enAuth) {
        window.location.href = '/paginas/ingreso.html';
      }
    }
    throw new Error('Sesión no autorizada o expirada');
  }

  // Respuesta sin contenido (204)
  if (respuesta.status === 204) {
    return null;
  }

  let datos = null;
  const esJson = (respuesta.headers.get('content-type') || '').includes('application/json');

  if (esJson) {
    try {
      datos = await respuesta.json();
    } catch {
      datos = null;
    }
  } else {
    datos = await respuesta.text();
  }

  // Si la respuesta trae { error } o el estado no es exitoso
  if (!respuesta.ok || (datos && typeof datos === 'object' && datos.error)) {
    const mensaje = (datos && typeof datos === 'object' && datos.error)
      ? datos.error
      : (typeof datos === 'string' && datos.trim() ? datos : `Error HTTP ${respuesta.status}`);
    throw new Error(mensaje);
  }

  return datos;
}

/**
 * Obtiene una lista de registros con filtros opcionales por query string
 * @param {string} col - Colección
 * @param {Object} [filtros={}] - Parámetros de consulta
 * @returns {Promise<Array>}
 */
export async function listar(col, filtros = {}) {
  const params = new URLSearchParams();
  for (const [clave, valor] of Object.entries(filtros)) {
    if (valor !== undefined && valor !== null) {
      params.append(clave, valor);
    }
  }
  const consulta = params.toString() ? `?${params.toString()}` : '';
  return llamar('GET', `/api/${col}${consulta}`);
}

/**
 * Obtiene un registro por su ID
 * @param {string} col - Colección
 * @param {string} id - ID del registro
 * @returns {Promise<Object>}
 */
export async function obtener(col, id) {
  return llamar('GET', `/api/${col}/${id}`);
}

/**
 * Crea un nuevo registro en una colección
 * @param {string} col - Colección
 * @param {Object} datos - Datos del registro
 * @returns {Promise<Object>}
 */
export async function crear(col, datos) {
  return llamar('POST', `/api/${col}`, datos);
}

/**
 * Actualiza un registro existente fusionando sus campos
 * @param {string} col - Colección
 * @param {string} id - ID del registro
 * @param {Object} cambios - Campos a actualizar
 * @returns {Promise<Object>}
 */
export async function actualizar(col, id, cambios) {
  return llamar('PUT', `/api/${col}/${id}`, cambios);
}

/**
 * Elimina un registro por su ID
 * @param {string} col - Colección
 * @param {string} id - ID del registro
 * @returns {Promise<any>}
 */
export async function eliminar(col, id) {
  return llamar('DELETE', `/api/${col}/${id}`);
}

/**
 * Sube un archivo mediante FormData en el campo "archivo"
 * @param {File|Blob} archivo - Archivo a subir
 * @returns {Promise<{ url: string }>}
 */
export async function subir(archivo) {
  const form = new FormData();
  form.append('archivo', archivo);
  return llamar('POST', '/api/subidas', form);
}

/**
 * Ejecuta una tarea del tutor o asistente de IA
 * @param {string} tarea - Nombre de la tarea (ej: 'tutor')
 * @param {Object} datos - Parámetros de la tarea
 * @returns {Promise<any>}
 */
export async function ia(tarea, datos) {
  return llamar('POST', `/api/ia/${tarea}`, datos);
}
