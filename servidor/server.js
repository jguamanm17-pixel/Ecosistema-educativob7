// servidor/server.js · Servidor base y API genérica
import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import express from 'express';
import * as almacen from './almacen.js';
import { puede } from './permisos.js';
import * as ganchos from './ganchos.js';
import { cargarUsuario } from './auth.js';

const app = express();
const PUERTO = Number(process.env.PORT) || Number(process.env.PUERTO) || 3000;

// Compatibilidad de audio para recursos de subidas (.mp3 servido con tipo correcto)
app.get('/recursos/subidas/:archivo', (req, res, next) => {
  const { archivo } = req.params;
  if (archivo.endsWith('.mp3')) {
    const nombreWav = archivo.replace(/\.mp3$/, '.wav');
    const rutaWav = path.resolve('publico', 'recursos', 'subidas', nombreWav);
    res.type('audio/wav');
    return res.sendFile(rutaWav, (err) => {
      if (err) next();
    });
  }
  next();
});

// Middleware base
app.use(express.static('publico'));
app.use(express.json({ limit: '1mb' }));
app.use(cargarUsuario);

// Envoltorio para capturar errores asíncronos y propagar err.estado
const asincrono = (controlador) => (req, res, next) => {
  Promise.resolve(controlador(req, res, next)).catch(next);
};

// Carga automática de rutas en servidor/rutas/*.js (orden alfabético)
async function montarRutas() {
  const rutaCarpeta = path.resolve('servidor', 'rutas');
  try {
    const archivos = await fs.readdir(rutaCarpeta);
    const modulosJs = archivos.filter((archivo) => archivo.endsWith('.js')).sort();

    for (const archivo of modulosJs) {
      const rutaArchivo = pathToFileURL(path.join(rutaCarpeta, archivo)).href;
      const modulo = await import(rutaArchivo);
      const enrutador = modulo.default;
      if (enrutador) {
        app.use('/api', enrutador);
      }
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('Error al montar rutas:', error.message);
    }
  }
}

// Montar rutas específicas antes de la API genérica
await montarRutas();

// --- API GENÉRICA (/api/:col y /api/:col/:id) ---

// GET /api/:col con filtros exactos por query
app.get(
  '/api/:col',
  asincrono(async (req, res) => {
    const { col } = req.params;
    const permitido = await puede(req.usuario, 'leer', col);
    if (!permitido) {
      return res.status(403).json({ error: 'Acceso no autorizado' });
    }

    let lista = await almacen.leer(col);
    lista = await ganchos.aplicar(col, 'filtrarLista', lista, req.usuario);

    const camposFiltro = Object.keys(req.query);
    if (camposFiltro.length > 0) {
      lista = lista.filter((item) =>
        camposFiltro.every((campo) => String(item[campo]) === String(req.query[campo]))
      );
    }

    res.json(lista);
  })
);

// GET /api/:col/:id
app.get(
  '/api/:col/:id',
  asincrono(async (req, res) => {
    const { col, id } = req.params;
    const lista = await almacen.leer(col);
    const registro = lista.find((item) => item.id === id);

    if (!registro) {
      return res.status(404).json({ error: 'Registro no encontrado' });
    }

    const permitido = await puede(req.usuario, 'leer', col, registro);
    if (!permitido) {
      return res.status(403).json({ error: 'Acceso no autorizado' });
    }

    res.json(registro);
  })
);

// POST /api/:col
app.post(
  '/api/:col',
  asincrono(async (req, res) => {
    const { col } = req.params;
    const permitido = await puede(req.usuario, 'escribir', col, req.body);
    if (!permitido) {
      return res.status(403).json({ error: 'Acceso no autorizado' });
    }

    const datos = await ganchos.aplicar(col, 'antesDeGuardar', req.body, req.usuario, null);
    const nuevo = await almacen.agregar(col, datos);
    await ganchos.aplicar(col, 'despuesDeGuardar', nuevo, req.usuario, null);

    res.status(201).json(nuevo);
  })
);

// PUT /api/:col/:id (fusiona campos)
app.put(
  '/api/:col/:id',
  asincrono(async (req, res) => {
    const { col, id } = req.params;
    const lista = await almacen.leer(col);
    const anterior = lista.find((item) => item.id === id);

    if (!anterior) {
      return res.status(404).json({ error: 'Registro no encontrado' });
    }

    const permitido = await puede(req.usuario, 'escribir', col, anterior);
    if (!permitido) {
      return res.status(403).json({ error: 'Acceso no autorizado' });
    }

    const cambios = await ganchos.aplicar(col, 'antesDeGuardar', req.body, req.usuario, anterior);
    const actualizado = await almacen.actualizar(col, id, cambios);
    await ganchos.aplicar(col, 'despuesDeGuardar', actualizado, req.usuario, anterior);

    res.json(actualizado);
  })
);

// DELETE /api/:col/:id
app.delete(
  '/api/:col/:id',
  asincrono(async (req, res) => {
    const { col, id } = req.params;
    const lista = await almacen.leer(col);
    const anterior = lista.find((item) => item.id === id);

    if (!anterior) {
      return res.status(404).json({ error: 'Registro no encontrado' });
    }

    const permitido = await puede(req.usuario, 'escribir', col, anterior);
    if (!permitido) {
      return res.status(403).json({ error: 'Acceso no autorizado' });
    }

    await almacen.eliminar(col, id);
    res.json({ ok: true });
  })
);

// Manejo centralizado de errores
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  const estado = err.estado || err.status || 500;
  res.status(estado).json({ error: err.message || 'Error interno del servidor' });
});

// Inicio del servidor solo si se ejecuta directamente
const servidor = app.listen(PUERTO, '0.0.0.0', () => {
  console.log(`Servidor iniciado en http://0.0.0.0:${PUERTO}`);
});

export { app, servidor };
