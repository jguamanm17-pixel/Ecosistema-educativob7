// servidor/rutas/subidas.js · Subida de archivos (imágenes, documentos y audios)
import { Router } from 'express';
import multer from 'multer';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { exigirRol } from '../auth.js';
import { leerConfig } from '../almacen.js';

const router = Router();

// Asegurar existencia de la carpeta de subidas
const CARPETA_SUBIDAS = path.resolve('publico', 'recursos', 'subidas');
if (!fs.existsSync(CARPETA_SUBIDAS)) {
  fs.mkdirSync(CARPETA_SUBIDAS, { recursive: true });
}

// Configuración de almacenamiento local
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, CARPETA_SUBIDAS);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const aleatorio = crypto.randomBytes(16).toString('hex');
    cb(null, `${aleatorio}${ext}`);
  }
});

const TIPOS_IMAGENES = ['image/jpeg', 'image/png', 'image/webp'];
const EXTENSIONES_IMAGENES = ['.jpg', '.jpeg', '.png', '.webp'];

const TIPOS_DOCENTES = [
  ...TIPOS_IMAGENES,
  'application/pdf',
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav'
];
const EXTENSIONES_DOCENTES = [
  ...EXTENSIONES_IMAGENES,
  '.pdf',
  '.mp3',
  '.wav'
];

// POST /api/subidas (campo "archivo")
router.post('/subidas', exigirRol(), async (req, res) => {
  const esDocenteOAdmin = req.usuario && (req.usuario.rol === 'admin' || req.usuario.rol === 'docente');
  const ajustes = await leerConfig('ajustes');
  const maxSubidaMB = (esDocenteOAdmin && ajustes?.maxSubidaMB) ? Number(ajustes.maxSubidaMB) : 2;
  const limiteBytes = maxSubidaMB * 1024 * 1024;

  const mimesPermitidos = esDocenteOAdmin ? TIPOS_DOCENTES : TIPOS_IMAGENES;
  const extensionesPermitidas = esDocenteOAdmin ? EXTENSIONES_DOCENTES : EXTENSIONES_IMAGENES;

  const upload = multer({
    storage,
    limits: { fileSize: limiteBytes },
    fileFilter: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const mimetype = (file.mimetype || '').toLowerCase();

      if (mimesPermitidos.includes(mimetype) && extensionesPermitidas.includes(ext)) {
        cb(null, true);
      } else {
        const mensaje = esDocenteOAdmin
          ? 'Solo se permiten imágenes (JPG, PNG, WEBP), documentos PDF o audios MP3'
          : 'Solo se permiten imágenes JPG, PNG o WEBP de hasta 2 MB';
        cb(new Error(mensaje));
      }
    }
  }).single('archivo');

  upload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          error: `El archivo supera el límite permitido de ${maxSubidaMB} MB`
        });
      }
      return res.status(400).json({ error: err.message });
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No se subió ningún archivo' });
    }

    // Ruta pública relativa para el cliente
    const url = `/recursos/subidas/${req.file.filename}`;
    res.json({ url });
  });
});

export default router;
