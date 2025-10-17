# Bot IJCV (Instituto José Cecilio del Valle) - Backend

Backend para un bot de WhatsApp que permite a los encargados de alumnos consultar el estado de pagos, registrar estudiantes y comunicarse con la administración del Instituto José Cecilio del Valle.

## Características

- Consulta de estado de pagos de colegiatura (mensualidad, mora, total).
- Registro y eliminación de estudiantes a una cuenta de encargado mediante ID y PIN.
- Broadcast de mensajes administrativos a todos los encargados.
- Panel web básico para subir archivos de relaciones y ver el estado del bot.
- Integración con archivos Excel en Dropbox para la gestión de datos.
- Endpoints para reiniciar el bot y mostrar el QR de autenticación.

## Tecnologías utilizadas

- Node.js / Express
- Baileys (API no oficial de WhatsApp)
- ExcelJS
- Multer (uploads)
- dotenv
- Dropbox SDK
- HTML/JS para el panel frontend

## Instalación y uso

1. **Clona el repositorio:**
   ```bash
   git clone https://github.com/velasquezhn3/backend.git
   cd backend
   ```

2. **Instala las dependencias:**
   ```bash
   npm install
   ```

3. **Crea un archivo `.env` con la configuración necesaria:**
   ```
   PORT=3000
   # Otras variables necesarias según config/config.js
   ```

4. **Ejecuta el servidor:**
   ```bash
   npm start
   ```

5. **Accede al panel web:**  
   Navega a `http://localhost:3000` para ver el dashboard, cargar archivos de relaciones y escanear el QR para iniciar sesión en WhatsApp.

## Endpoints principales

- `GET /qr` - Muestra el código QR actual para login en WhatsApp.
- `POST /restart` - Borra los datos de sesión y reinicia el bot (proteger en producción).
- `POST /upload` - Permite subir el archivo de relaciones (`.xlsx`).
- Archivos estáticos en `/public`.

## Estructura de carpetas

- `/controllers`: Lógica principal del bot (conversación, menús, estados).
- `/services`: Acceso y procesamiento de datos (Excel, PIN, etc).
- `/config`: Configuración de columnas, archivos, etc.
- `/public`: Panel web y recursos estáticos.
- `/data`: QR, sesiones y archivos temporales.

## Recomendaciones de mejora

- Implementar autenticación en endpoints críticos.
- Añadir tests automáticos y CI.
- Considerar migrar a base de datos si el volumen crece.
- Refactorizar lógica conversacional a módulos más pequeños.

## Licencia

ISC

---

**Desarrollado por:** velasquezhn3
