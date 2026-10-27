// publico/js/modulos/asignaturas.js · Vista del catálogo de asignaturas y avance
import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import { aviso, cargando, escapar } from '../nucleo/ui.js';

/**
 * Calcula el avance porcentual de un estudiante en una asignatura
 * según la cantidad de temas publicados revisados sobre el total.
 * @param {string} asignaturaId - ID de la asignatura
 * @returns {Promise<{porcentaje: number, revisados: number, total: number}>}
 */
export async function calcularAvance(asignaturaId) {
  try {
    const [unidades, temas, progreso] = await Promise.all([
      api.listar('unidades'),
      api.listar('temas'),
      api.listar('progreso-temas')
    ]);

    // 1. Unidades visibles de la asignatura
    const idsUnidades = new Set(
      unidades
        .filter((u) => u.asignaturaId === asignaturaId && u.visible !== false)
        .map((u) => u.id)
    );

    // 2. Temas publicados de esas unidades
    const temasPublicados = temas.filter(
      (t) => idsUnidades.has(t.unidadId) && t.estado === 'publicado'
    );
    const total = temasPublicados.length;

    if (total === 0) {
      return {
        porcentaje: 0,
        revisados: 0,
        total: 0,
        valueOf() {
          return 0;
        },
        toString() {
          return '0';
        }
      };
    }

    // 3. Temas revisados que coinciden con los publicados
    const idsProgreso = new Set(progreso.map((p) => p.temaId));
    const revisados = temasPublicados.filter((t) => idsProgreso.has(t.id)).length;
    const porcentaje = Math.round((revisados / total) * 100);

    return {
      porcentaje,
      revisados,
      total,
      valueOf() {
        return porcentaje;
      },
      toString() {
        return String(porcentaje);
      }
    };
  } catch (error) {
    console.error('Error calculando avance:', error);
    return {
      porcentaje: 0,
      revisados: 0,
      total: 0,
      valueOf() {
        return 0;
      },
      toString() {
        return '0';
      }
    };
  }
}

// Cargar y renderizar las asignaturas del usuario
async function cargarMisAsignaturas(cuadricula) {
  cargando(true);
  try {
    const asignaturas = await api.listar('asignaturas');

    if (asignaturas.length === 0) {
      cuadricula.innerHTML = `
        <div class="tarjeta" style="grid-column: 1 / -1; text-align: center; padding: var(--espacio-xl); color: var(--color-texto-suave);">
          <p style="font-size: var(--tamano-lg); margin-bottom: var(--espacio-xs);">No tienes asignaturas matriculadas.</p>
          <p style="font-size: var(--tamano-sm);">Consulta con la coordinación académica o tu docente asignado.</p>
        </div>
      `;
      return;
    }

    cuadricula.innerHTML = '';

    for (const asg of asignaturas) {
      const avance = await calcularAvance(asg.id);

      const article = document.createElement('article');
      article.className = 'materia-tarjeta';

      article.innerHTML = `
        <div>
          <div class="materia-tarjeta__cabecera">
            <span class="materia-tarjeta__nivel">${escapar(asg.nivel || 'Educación Superior')}</span>
            <h2 class="materia-tarjeta__titulo">${escapar(asg.nombre)}</h2>
          </div>
          <div class="materia-tarjeta__cuerpo">
            <p class="materia-tarjeta__descripcion">${escapar(asg.descripcion || 'Sin descripción disponible.')}</p>
          </div>
        </div>

        <div>
          <div class="materia-tarjeta__avance">
            <div class="materia-tarjeta__avance-header">
              <span>Progreso de contenidos:</span>
              <span class="materia-tarjeta__avance-porcentaje">${avance.porcentaje}% (${avance.revisados}/${avance.total} temas)</span>
            </div>
            <div class="progreso" role="progressbar" aria-valuenow="${avance.porcentaje}" aria-valuemin="0" aria-valuemax="100" aria-label="Avance en ${escapar(asg.nombre)}">
              <div class="progreso__barra" style="width: ${avance.porcentaje}%;"></div>
            </div>
          </div>

          <div class="materia-tarjeta__pie">
            <a href="/paginas/asignatura.html?id=${encodeURIComponent(asg.id)}" class="btn btn--primario" style="width: 100%; text-align: center;">
              Ver contenido académico →
            </a>
          </div>
        </div>
      `;

      cuadricula.appendChild(article);
    }
  } catch (error) {
    aviso(error.message || 'Error al cargar asignaturas', 'error');
    cuadricula.innerHTML = `
      <div class="tarjeta" style="grid-column: 1 / -1; text-align: center; color: var(--color-error); padding: var(--espacio-l);">
        ${escapar(error.message || 'Error de conexión')}
      </div>
    `;
  } finally {
    cargando(false);
  }
}

// Ejecución condicional solo si estamos en asignaturas.html
const contenedorCuadricula = document.getElementById('cuadricula-mis-asignaturas');
if (contenedorCuadricula) {
  await montarPlantilla({ titulo: 'Mis asignaturas', roles: ['estudiante', 'docente', 'admin'] });
  await cargarMisAsignaturas(contenedorCuadricula);
}
