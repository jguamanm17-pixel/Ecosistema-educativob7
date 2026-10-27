# Guía de Despliegue en Render.com · Ecosistema Educativo Digital

Esta guía describe los pasos sencillos para publicar la plataforma en [Render.com](https://render.com).

---

## 1. Opciones de Despliegue en Render

### Opción A (Recomendada): Vía Repositorio GitHub / GitLab
1. Crea un repositorio privado o público en GitHub (ej: `ecosistema-educativo`).
2. Descomprime este paquete y sube los archivos a tu repositorio:
   ```bash
   git init
   git add .
   git commit -m "Publicación inicial del ecosistema"
   git branch -M main
   git remote add origin https://github.com/tu-usuario/tu-repositorio.git
   git push -u origin main
   ```
3. En Render.com, haz clic en **New +** → **Web Service** y selecciona tu repositorio.

---

### Opción B: Despliegue Manual o con Render CLI
Si prefieres usar Render CLI o Docker, el proyecto ya cuenta con el comando de inicio estándar `npm start`.

---

## 2. Configuración del Servicio Web en Render.com

Cuando Render solicite los parámetros del servicio, completa lo siguiente:

| Parámetro | Valor |
| :--- | :--- |
| **Name** | `ecosistema-educativo` (o el nombre que elijas) |
| **Language / Environment** | `Node` |
| **Branch** | `main` |
| **Region** | `Oregon (US West)` o la más cercana a tu país |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |
| **Instance Type** | `Free` (o plan de tu preferencia) |

---

## 3. Variables de Entorno (Environment Variables)

En la pestaña **Environment** de tu servicio en Render, agrega las siguientes variables:

- `NODE_ENV`: `production`
- `IA_PROVEEDOR`: `gemini`
- `IA_MODELO`: `gemini-3.5-flash-lite` (o el modelo que prefieras de Gemini)
- `IA_CLAVE`: Tu clave de API de Google Gemini (ej: en Google AI Studio)

*(Nota: Render asigna automáticamente la variable `PORT`. El servidor ya está preparado para escuchar en `0.0.0.0` y en el puerto asignado por Render).*

---

## 4. Persistencia de Datos
El proyecto almacena datos en archivos JSON dentro de la carpeta `datos/`.
- En el plan gratuito de Render, el sistema de archivos es efímero entre reinicios.
- Si deseas conservar cambios creados por los usuarios de forma permanente a largo plazo en Render, puedes agregar un **Render Disk** montado en el directorio `/datos` desde la pestaña **Disks** del servicio.

---

## 5. Cuentas de Acceso Inicial
Una vez desplegado, podrás ingresar inmediatamente con:
- **Administrador:** `admin@demo.ec` / `Demo12345`
- **Docente:** `docente1@demo.ec` / `Demo12345`
- **Estudiante:** `estudiante1@demo.ec` / `Demo12345`
