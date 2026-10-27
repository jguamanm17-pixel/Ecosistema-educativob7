// servidor/rutas/gamificacion.js · Rutas de intentos y logros
import { Router } from 'express';
import * as almacen from '../almacen.js';
import { procesarIntento } from '../gamificacion.js';
import { estudiantesDe } from '../acceso.js';

const router = Router();

const asincrono = (controlador) => (req, res, next) => {
  Promise.resolve(controlador(req, res, next)).catch(next);
};

// POST /api/intentos
router.post(
  '/intentos',
  asincrono(async (req, res) => {
    if (!req.usuario) {
      return res.status(401).json({ error: 'Acceso no autorizado' });
    }

    try {
      const resultado = await procesarIntento(req.usuario, req.body);
      res.status(201).json(resultado);
    } catch (error) {
      const estado = error.estado || 400;
      res.status(estado).json({ error: error.message });
    }
  })
);

// GET /api/logros/:usuarioId ("yo" permitido)
router.get(
  '/logros/:usuarioId',
  asincrono(async (req, res) => {
    if (!req.usuario) {
      return res.status(401).json({ error: 'Acceso no autorizado' });
    }

    const { usuarioId } = req.params;
    const targetId = usuarioId === 'yo' ? req.usuario.id : usuarioId;

    // Control de acceso: propio estudiante, docente de su grupo o admin
    let permitido = false;

    if (req.usuario.rol === 'admin' || req.usuario.id === targetId) {
      permitido = true;
    } else if (req.usuario.rol === 'docente') {
      const misEstudiantes = await estudiantesDe(req.usuario.id);
      if (misEstudiantes.includes(targetId)) {
        permitido = true;
      }
    }

    if (!permitido) {
      return res.status(403).json({ error: 'Acceso no autorizado a los logros de este usuario' });
    }

    const todosLogros = await almacen.leer('logros');
    const logro = todosLogros.find((l) => l.usuarioId === targetId) || {
      usuarioId: targetId,
      puntos: 0,
      insignias: [],
      nivelQuiz: {}
    };

    res.json(logro);
  })
);

export default router;
