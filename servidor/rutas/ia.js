// servidor/rutas/ia.js · Rutas para el servicio de Inteligencia Artificial
import { Router } from 'express';
import { exigirRol } from '../auth.js';
import {
  ejecutarTarea,
  obtenerConfiguracionIa,
  guardarConfiguracionIa,
  probarConexionIa
} from '../ia.js';

const router = Router();

const asincrono = (controlador) => (req, res, next) => {
  Promise.resolve(controlador(req, res, next)).catch(next);
};

const MODELOS_SUGERIDOS = [
  'gemini-3.8-flash',
  'gemini-4-argon',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-pro'
];

// GET /api/ia/prueba (solo admin)
router.get(
  '/ia/prueba',
  exigirRol('admin'),
  asincrono(async (_req, res) => {
    const config = await obtenerConfiguracionIa();
    res.json({
      estado: 'ok',
      proveedor: config.claveIa ? 'externo' : 'local',
      modelo: config.modelo,
      claveConfigurada: Boolean(config.claveIa)
    });
  })
);

// GET /api/ia/config (solo admin) - Consulta clave enmascarada y modelo actual
router.get(
  '/ia/config',
  exigirRol('admin'),
  asincrono(async (_req, res) => {
    const config = await obtenerConfiguracionIa();
    res.json({
      claveIa: config.claveIa,
      claveEnmascarada: config.claveIa
        ? `${config.claveIa.slice(0, 8)}...${config.claveIa.slice(-4)}`
        : '',
      modelo: config.modelo,
      proveedor: config.proveedor,
      modelosSugeridos: MODELOS_SUGERIDOS
    });
  })
);

// PUT /api/ia/config (solo admin) - Guarda clave y modelo en caliente (.env y ajustes.json)
router.put(
  '/ia/config',
  exigirRol('admin'),
  asincrono(async (req, res) => {
    const { claveIa, modelo, proveedor } = req.body;
    const resultado = await guardarConfiguracionIa({ claveIa, modelo, proveedor });
    res.json({
      ok: true,
      mensaje: 'Configuración de IA guardada exitosamente',
      ...resultado
    });
  })
);

// POST /api/ia/probar-conexion (solo admin) - Verifica conectividad con Google Gemini
router.post(
  '/ia/probar-conexion',
  exigirRol('admin'),
  asincrono(async (req, res) => {
    const { claveIa, modelo } = req.body || {};
    const resultado = await probarConexionIa(claveIa, modelo);
    res.json(resultado);
  })
);

// POST /api/ia/:tarea (requiere sesión)
router.post(
  '/ia/:tarea',
  asincrono(async (req, res) => {
    if (!req.usuario) {
      return res.status(401).json({ error: 'Acceso no autorizado' });
    }

    try {
      const { tarea } = req.params;
      const formato = req.body?.formato || (tarea === 'tutor' || tarea.startsWith('rol-') ? 'texto' : 'json');
      const resultado = await ejecutarTarea(tarea, req.body, req.usuario, { formato });
      if (typeof resultado === 'string') {
        res.json({ ok: true, respuesta: resultado });
      } else {
        res.json(resultado);
      }
    } catch (error) {
      const estado = error.estado || 400;
      res.status(estado).json({ error: error.message });
    }
  })
);

export default router;
