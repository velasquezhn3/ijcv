/* Controlador para conexión y manejo del bot WhatsApp.
 */

const whatsappClient = require('../services/whatsappClient');
const qrcodeTerminal = require('qrcode-terminal');
const qrcode = require('qrcode');
const fs = require('fs');
const path = require('path');
const {
  buscarEstudiante,
  calcularDeuda
} = require('../services/studentService');
const {
  validarPIN
} = require('../services/pinService');
const {
  registrarEncargado,
  obtenerAlumnosEncargado,
  eliminarRelacion
} = require('../services/encargadoService');
const {
  establecerEstado,
  obtenerEstado,
  establecerUltimoSaludo,
  obtenerUltimoSaludo
} = require('../services/stateService');
const { infoEscuela, dataDir } = require('../config/config');
const { isAdmin } = require('../services/adminService');

const { appendLog } = require('../utils/logger');

// Configuración de grados con sus imágenes correspondientes
const GRADOS_CONFIG = {
  '1': { nombre: 'Pre-Escolar (Bilingüe)', imagen: 'img1.jpeg' },
  '2': { nombre: '1st - 3rd Grade (Bilingüe)', imagen: 'img2.jpeg' },
  '3': { nombre: '4th - 6th Grade (Bilingüe)', imagen: 'img3.jpeg' },
  '4': { nombre: '7th Grade (Bilingüe)', imagen: 'img4.jpeg' },
  '5': { nombre: '8th - 9th Grade (Bilingüe)', imagen: 'img5.jpeg' },
  '6': { nombre: '10th - 11th Grade (Bilingüe)', imagen: 'img6.jpeg' },
  '7': { nombre: '7mo Grado (Español)', imagen: 'img7.jpeg' },
  '8': { nombre: '8vo - 9no Grado (Español)', imagen: 'img8.jpeg' },
  '9': { nombre: '10mo - 11vo Grado (Español)', imagen: 'img9.jpeg' }
};

// Función auxiliar para delay
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Función para leer imágenes de forma segura
async function leerImagen(nombreArchivo) {
  try {
    const imagePath = path.join(__dirname, '..', nombreArchivo);
    console.log(`Leyendo imagen: ${imagePath}`);
    return await fs.promises.readFile(imagePath);
  } catch (error) {
    console.error(`Error leyendo imagen ${nombreArchivo}:`, error);
    throw error;
  }
}

// Función para enviar el menú de grados
async function enviarMenuGrados(bot, remitente) {
  const menuText = `📚 *¿En qué grado estás interesado?*

Por favor selecciona una opción:

*Programa Bilingüe:*
1️⃣ Pre-Escolar (Pre-Kínder y Kínder)
2️⃣ 1st - 3rd Grade
3️⃣ 4th - 6th Grade
4️⃣ 7th Grade
5️⃣ 8th - 9th Grade
6️⃣ 10th - 11th Grade (Bachillerato)

*Programa Español:*
7️⃣ 7mo Grado
8️⃣ 8vo - 9no Grado
9️⃣ 10mo - 11vo Grado (Bachillerato)

📝 *Escribe el número de tu opción (1-9)*`;

  await bot.sendMessage(remitente, { text: menuText });

  // Actualizar estado del usuario
  establecerEstado(remitente, 'esperando_grado');
}

// Función para enviar PDF de transporte
async function enviarPDFTransporte(bot, remitente) {
  try {
    const pdfPath = path.join(__dirname, '..', 'transporte.pdf');
    const pdfBuffer = await fs.promises.readFile(pdfPath);
    await bot.sendMessage(remitente, {
      document: pdfBuffer,
      mimetype: 'application/pdf',
      fileName: 'transporte.pdf',
      caption: '📄 Información sobre transporte escolar.'
    });
  } catch (error) {
    console.error('Error enviando PDF de transporte:', error);
    await bot.sendMessage(remitente, {
      text: "❌ Lo siento, hubo un error al cargar el PDF de transporte. Por favor contacta directamente al 9503-1205 para recibir asistencia inmediata."
    });
  }
}

// Función para enviar información de un grado específico
async function enviarInformacionGrado(bot, remitente, opcionGrado) {
  try {
    const grado = GRADOS_CONFIG[opcionGrado];

    if (!grado) {
      await bot.sendMessage(remitente, {
        text: "❌ Opción no válida. Por favor selecciona un número del 1 al 9."
      });
      return false;
    }

    // Enviar mensaje de confirmación
    await bot.sendMessage(remitente, {
      text: `✅ Perfecto, te envío la información de *${grado.nombre}*...\n\n⏳ Un momento por favor...`
    });

    await delay(1000);

    // Enviar imagen del grado seleccionado
    const imagenGrado = await leerImagen(grado.imagen);
    await bot.sendMessage(remitente, {
      image: imagenGrado,
      mimetype: 'image/jpeg',
      caption: `📊 *Información de ${grado.nombre}*\n\nPrecios y detalles del programa educativo.`
    });

    await delay(1500);

    // Enviar imagen de requisitos (img10)
    const imagenRequisitos = await leerImagen('img10.jpeg');
    await bot.sendMessage(remitente, {
      image: imagenRequisitos,
      mimetype: 'image/jpeg',
      caption: `📋 *Requisitos de Inscripción*\n\nDocumentación necesaria para matricularse.`
    });

    await delay(1000);

    // Preguntar si desea ver más grados o información de transporte
    await bot.sendMessage(remitente, {
      text: `✅ *Información enviada correctamente*\n\n¿Deseas consultar información de otro grado?\n\n1️⃣ Sí, ver otros grados\n2️⃣ Volver al menú principal\n3️⃣ Información sobre transporte\n\n📝 *Escribe 1, 2 o 3*`
    });

    // Actualizar estado
    establecerEstado(remitente, 'consulta_adicional');
    return true;

  } catch (error) {
    console.error('Error enviando información del grado:', error);
    await bot.sendMessage(remitente, {
      text: "❌ Lo siento, hubo un error al cargar las imágenes. Por favor contacta directamente al 9503-1205 para recibir asistencia inmediata."
    });
    return false;
  }
}

/**
 * Envía el menú principal al usuario.
 * @param {Object} bot - Instancia del bot.
 * @param {string} remitente - Número del usuario.
 */
async function enviarBroadcast(bot, mensaje) {
  const fs = require('fs');
  const path = require('path');
  // Use absolute path to ensure correct file resolution
  const encargadosFilePath = path.join(__dirname, '../encargados.json');
  console.log(`Reading encargados.json from: ${encargadosFilePath}`);

  let encargadosDB = { encargados: {} };
  try {
    if (fs.existsSync(encargadosFilePath)) {
      const fileContent = fs.readFileSync(encargadosFilePath, 'utf8');
      console.log(`encargados.json content: ${fileContent.slice(0, 500)}`);
      try {
        encargadosDB = JSON.parse(fileContent);
      } catch (parseError) {
        console.error('Error parsing encargados.json:', parseError);
        return 0;
      }
    } else {
      console.warn('encargados.json file does not exist at path:', encargadosFilePath);
    }
  } catch (error) {
    console.error('Error al leer encargados.json:', error);
    return 0;
  }

  const destinatarios = Object.keys(encargadosDB.encargados);
  console.log(`Broadcast recipients: ${destinatarios.join(', ')}`);
  let enviados = 0;

  for (const destinatario of destinatarios) {
    try {
      console.log(`Sending message to ${destinatario}`);

      if (typeof mensaje === 'string') {
        await bot.sendMessage(destinatario, { text: mensaje });
      } else if (typeof mensaje === 'object') {
        console.log('Message keys:', Object.keys(mensaje));
        // Unwrap extendedTextMessage if present
        let msgContent = mensaje;
        if (mensaje.extendedTextMessage && mensaje.extendedTextMessage.contextInfo && mensaje.extendedTextMessage.contextInfo.quotedMessage) {
          msgContent = mensaje.extendedTextMessage.contextInfo.quotedMessage;
        }

        if (msgContent.conversation) {
          // Text message
          await bot.sendMessage(destinatario, { text: msgContent.conversation });
        } else if (msgContent.imageMessage || msgContent.videoMessage || msgContent.audioMessage || msgContent.documentMessage || msgContent.stickerMessage) {
          // Support media broadcast. msgContent may contain a pre-downloaded _media (from whatsappClient.downloadMedia) or be a Baileys-like message requiring download.
          console.log('Preparing media message for broadcast...');
          let mediaBuffer = null;
          let mimetype = null;
          let filename = null;

          if (msgContent._media) {
            mediaBuffer = msgContent._media.buffer;
            mimetype = msgContent._media.mimetype;
            filename = msgContent._media.filename;
          } else if (typeof msgContent.getMedia === 'function') {
            // If it's a whatsapp-web.js Message instance
            const media = await whatsappClient.downloadMedia(msgContent);
            if (media) {
              mediaBuffer = media.buffer;
              mimetype = media.mimetype;
              filename = media.filename;
            }
          } else {
            // Fallback: attempt to use whatsappClient.downloadMedia with the raw object
            try {
              const media = await whatsappClient.downloadMedia(msgContent);
              if (media) {
                mediaBuffer = media.buffer;
                mimetype = media.mimetype;
                filename = media.filename;
              }
            } catch (e) {
              console.error('Could not download media for broadcast:', e);
            }
          }

          if (!mediaBuffer) {
            console.warn(`No media buffer available for broadcast to ${destinatario}, skipping.`);
            continue;
          }

          // Determine how to send based on message kind
          if (msgContent.imageMessage) {
            await bot.sendMessage(destinatario, { image: mediaBuffer, caption: msgContent.caption || '' });
          } else if (msgContent.videoMessage) {
            await bot.sendMessage(destinatario, { video: mediaBuffer, caption: msgContent.caption || '' });
          } else if (msgContent.audioMessage) {
            await bot.sendMessage(destinatario, { audio: mediaBuffer, mimetype: msgContent.audioMessage?.mimetype || mimetype || 'audio/mpeg' });
          } else if (msgContent.documentMessage) {
            await bot.sendMessage(destinatario, { document: mediaBuffer, mimetype: msgContent.documentMessage?.mimetype || mimetype || 'application/octet-stream', fileName: msgContent.documentMessage?.fileName || filename || 'document' });
          } else if (msgContent.stickerMessage) {
            await bot.sendMessage(destinatario, { sticker: mediaBuffer });
          }
        } else if (msgContent.extendedTextMessage && msgContent.extendedTextMessage.text) {
          await bot.sendMessage(destinatario, { text: msgContent.extendedTextMessage.text });
        } else {
          console.warn(`Unsupported message object for broadcast to ${destinatario}, skipping.`);
          continue;
        }
      } else {
        console.warn(`Mensaje de tipo no soportado para destinatario ${destinatario}`);
        continue;
      }
      enviados++;
      console.log(`Mensaje enviado a ${destinatario}`);
    } catch (error) {
      console.error(`Error enviando mensaje a ${destinatario}:`, error);
    }
    const delayMs = Math.floor(Math.random() * 15000) + 5000; // 5 to 20 seconds
    await delay(delayMs);
  }
  return enviados;
}

async function enviarMenuPrincipal(bot, remitente) {
  const alumnos = obtenerAlumnosEncargado(remitente);
  let mensaje = `🏫 *BIENVENIDO AL SISTEMA ESCOLAR*\n\n`;

  if (alumnos.length > 0) {
    mensaje += `👨‍👩‍👧‍👦 Tiene ${alumnos.length} alumno(s) registrado(s)\n\n`;
  }

  mensaje += `Seleccione una opción:\n\n`;
  mensaje += `1️⃣ *Información* de matrícula\n`;
  mensaje += `2️⃣ *Registrar* nuevo alumno\n`;
  mensaje += `3️⃣ *Consultar* estado de pagos\n`;
  mensaje += `4️⃣ *Información* de la escuela\n`;
  mensaje += `5️⃣ *Contactar* administración\n`;

  if (alumnos.length > 0) {
    mensaje += `6️⃣ *Eliminar* alumno de mi cuenta\n`;
  }

  // Add admin-only menu option
  if (isAdmin(remitente)) {
    mensaje += `7️⃣ *Broadcast Admin*\n`;
  }

  mensaje += `\nResponda con el número de la opción deseada.`;

  establecerEstado(remitente, 'MENU_PRINCIPAL');
  await bot.sendMessage(remitente, { text: mensaje });
}

/**
 * Envía el estado de pagos detallado al usuario.
 * @param {Object} bot - Instancia del bot.
 * @param {string} remitente - Número del usuario.
 * @param {Object} estudiante - Información del estudiante.
 */
async function enviarEstadoPagos(bot, remitente, estudiante) {
  if (!estudiante || !estudiante.nombre) {
    await bot.sendMessage(remitente, {
      text: '❌ No se encontró información del alumno. Por favor contacte a administración.'
    });
    return;
  }

  const deuda = calcularDeuda(estudiante);
  // Define ordered months array in lowercase
  const mesesOrdenados = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const mesActualIndex = new Date().getMonth(); // 0-based index

  // Determine starting month index based on planDePago
  const inicioMesIndex = estudiante.planDePago === 10 ? 1 : 0; // febrero index 1, enero index 0

  const mesesHastaActualLower = mesesOrdenados.slice(inicioMesIndex, mesActualIndex + 1);

  const mesesKeys = Object.keys(estudiante.meses);

  let respuesta = `📊 *ESTADO DE PAGOS - ${estudiante.nombre.toUpperCase()}*\n`;
  respuesta += `🏫 Grado: ${estudiante.grado}\n\n`;

  mesesKeys
    .filter(mes => mesesHastaActualLower.includes(mes.toLowerCase()))
    .forEach(mes => {
      const valorMes = estudiante.meses[mes];
      const estado = valorMes ? `L.${parseFloat(valorMes).toFixed(2)} ✅ Pagado` : '❌ Pendiente';
      respuesta += `▫️ ${mes.charAt(0).toUpperCase() + mes.slice(1)}: ${estado}\n`;
    });

  respuesta += `\n💵 Cuota mensual: L.${deuda.cuotaMensual}`;
  respuesta += `\n📅 Meses pendientes: ${deuda.mesesPendientes.length}`;
  respuesta += deuda.alDia
    ? '\n\n✅ *AL DÍA EN PAGOS*'
    : `\n\n❌ *DEUDA MENSUALIDAD: L.${deuda.deudaMensualidad}*\n❌ *DEUDA MORA: L.${deuda.deudaMora}*\n❌ *DEUDA TOTAL: L.${deuda.totalDeuda}*`;

  await bot.sendMessage(remitente, { text: respuesta });
}

/**
 * Envía la información académica completa al usuario.
 * @param {Object} bot - Instancia del bot.
 * @param {string} remitente - Número del usuario.
 * @param {Object} estudiante - Información del estudiante.
 */
async function enviarInformacionAcademicaCompleta(bot, remitente, estudiante) {
  if (!estudiante || !estudiante.nombre) {
    await bot.sendMessage(remitente, {
      text: '❌ No se encontró información del alumno. Por favor contacte a administración.'
    });
    return;
  }

  let respuesta = `📚 *INFORMACIÓN ACADÉMICA COMPLETA - ${estudiante.nombre.toUpperCase()}*\n`;
  respuesta += `🏫 Grado: ${estudiante.grado}\n\n`;

  // Assuming estudiante has academic fields like subjects, grades, etc.
  // If estudiante.materias exists, list them
  if (estudiante.materias && Object.keys(estudiante.materias).length > 0) {
    respuesta += `📖 *Materias y Calificaciones:*\n`;
    for (const [materia, calificacion] of Object.entries(estudiante.materias)) {
      respuesta += `▫️ ${materia}: ${calificacion}\n`;
    }
    respuesta += `\n`;
  }

  // Add other academic info if available
  if (estudiante.promedio) {
    respuesta += `📊 Promedio General: ${estudiante.promedio}\n`;
  }

  if (estudiante.conducta) {
    respuesta += `🤝 Conducta: ${estudiante.conducta}\n`;
  }

  if (estudiante.asistencia) {
    respuesta += `📅 Asistencia: ${estudiante.asistencia}%\n`;
  }

  respuesta += `\nPara más detalles, contacte a la administración.`;

  await bot.sendMessage(remitente, { text: respuesta });
}



async function enviarMensajeConDelay(bot, remitente, mensaje) {
  const delayMs = Math.floor(Math.random() * 15000) + 5000; // 5 to 20 seconds
  await delay(delayMs);
  await bot.sendMessage(remitente, mensaje);
}

/**
 * Procesa los mensajes recibidos y maneja la lógica de conversación.
 * @param {Object} bot - Instancia del bot.
 * @param {string} remitente - Número del usuario.
 * @param {string} mensaje - Texto del mensaje recibido.
 */
async function procesarMensaje(bot, remitente, mensaje, mensajeObj) {
  const estado = obtenerEstado(remitente);
  const alumnos = obtenerAlumnosEncargado(remitente);
  const textoMinuscula = mensaje.toLowerCase();

  // Log message processing event
  appendLog({
    tipo: 'mensaje',
    fecha: new Date().toISOString(),
    usuario: remitente,
    detalle: `Mensaje procesado: ${mensaje}`
  });

  // Check if greeting was sent today
  const hoy = new Date().toISOString().slice(0, 10);
  const ultimoSaludo = obtenerUltimoSaludo(remitente);
  let esPrimerMensajeDelDia = false;

  if (ultimoSaludo !== hoy) {
    esPrimerMensajeDelDia = true;
    establecerUltimoSaludo(remitente, hoy);
    const saludo = `🐺 ¡Hola! Soy Chilo el lobo asistente virtual del Instituto José Cecilio del Valle.\nEstoy aquí para ayudarte. ¿En qué puedo asistirte hoy? 📚✨.`;
    await enviarMensajeConDelay(bot, remitente, { text: saludo });
    // Set state to MENU_PRINCIPAL after greeting
    establecerEstado(remitente, 'MENU_PRINCIPAL');
    await enviarMenuPrincipal(bot, remitente);
    return;
  }

  // Handle broadcast messages in MENU_ADMIN_BROADCAST state
  if (estado.estado === 'MENU_ADMIN_BROADCAST') {
    console.log(`Entered MENU_ADMIN_BROADCAST state with message from ${remitente}`);
    if (!isAdmin(remitente)) {
      console.log(`User ${remitente} is not admin, broadcast denied.`);
      await bot.sendMessage(remitente, { text: '❌ No tiene permisos para enviar mensajes broadcast.' });
      establecerEstado(remitente, 'MENU_PRINCIPAL');
      await enviarMenuPrincipal(bot, remitente);
      return;
    }
    console.log(`Broadcast message received from admin ${remitente} in MENU_ADMIN_BROADCAST state.`);

    // Send the full message object for broadcast
    const enviados = await enviarBroadcast(bot, mensajeObj);
    console.log(`Broadcast sent to ${enviados} encargados.`);
    await bot.sendMessage(remitente, { text: `✅ Se mandaron ${enviados} encargados.` });
    establecerEstado(remitente, 'MENU_PRINCIPAL');
    await enviarMenuPrincipal(bot, remitente);
    return;
  }

  // Check for broadcast command from admin
  if (textoMinuscula.startsWith('broadcast ') || textoMinuscula.startsWith('bc ')) {
    console.log(`Broadcast command received from ${remitente}`);
    if (!isAdmin(remitente)) {
      console.log(`User ${remitente} is not admin, broadcast denied.`);
      await bot.sendMessage(remitente, { text: '❌ No tiene permisos para enviar mensajes broadcast.' });
      return;
    }
    console.log(`User ${remitente} is admin, proceeding with broadcast.`);

    // Remove the command prefix and get the rest of the message as broadcast content
    let textoBroadcast = mensaje;
    if (textoMinuscula.startsWith('broadcast ')) {
      textoBroadcast = mensaje.substring(10).trim();
    } else if (textoMinuscula.startsWith('bc ')) {
      textoBroadcast = mensaje.substring(3).trim();
    }

    // Send as text message broadcast
    const enviados = await enviarBroadcast(bot, textoBroadcast);
    console.log(`Broadcast sent to ${enviados} encargados.`);
    await bot.sendMessage(remitente, { text: `✅ Se mandaron ${enviados} encargados.` });
    return;
  }

  if (textoMinuscula === 'menu' || textoMinuscula === 'menú') {
    await enviarMenuPrincipal(bot, remitente);
    return;
  }

  switch (estado.estado) {
    case 'MENU_PRINCIPAL':
      switch (mensaje) {
        case '1':
          try {
            // Primer mensaje - Información institucional y modalidades
            await bot.sendMessage(remitente, {
              text: `🏫 *C.E.N.G. "JOSÉ CECILIO DEL VALLE"*
*¡43 años formando líderes!*

🌟 *Ventajas de nuestra institución:*
• 100% Bilingüe
• 43 años de experiencia educativa
• Docentes calificados y certificados
• Instalaciones modernas y completas

📚 *Modalidades Educativas:*

*🔹 Programa Bilingüe:*
   • *Pre-Escolar:*
     - Pre-Kínder (4 años cumplidos hasta Abril 2025)
     - Kínder (5 años cumplidos hasta Abril 2025)
   • *Educación Básica:* 1° a 9° Grado
   • *Educación Media:* 10° y 11° - Bachillerato en Ciencias y Humanidades

*🔹 Programa Español:*
   • 7° a 9° Grado
   • 10° a 11° - Bachillerato en Ciencias y Humanidades

📅 *Ciclo Escolar 2025:*
   Período: Febrero a Noviembre

📍 *Ubicación:*
   Comayagüela, M.D.C.

⏰ *Jornada Diaria:*
   7:05 AM - 1:20 PM`
            });

            // Pausa para mejor experiencia de lectura
            await delay(2000);

            // Segundo mensaje - Instalaciones, actividades y matrícula
            await bot.sendMessage(remitente, {
              text: `🏢 *Infraestructura y Servicios:*

🔬 *Laboratorios:*
   • Ciencias Naturales
   • Tecnología
   • Computación

🎯 *Áreas Especializadas:*
   • Departamento de Psicología
   • Departamento de Consejería
   • Biblioteca escolar
   • Cafetería
   • Tienda escolar
   • Área recreativa

⚽ *Actividades Extracurriculares:*
   • Fútbol
   • Baloncesto
   • Voleibol
   • Banda Marcial
   • Ajedrez

🏟️ *Espacios Deportivos:*
   • Canchas múltiples

📋 *Proceso de Matrícula 2025:*
🗓️ *Fechas:* 17 de Noviembre - 12 de Diciembre 2025

⏰ *Horario de atención:*
   Lunes a Viernes: 8:00 AM - 2:00 PM
   Sábados: 8:00 AM - 12:00 PM

📞 *Contacto y Información:*
   Teléfonos: 2226-8440 / 2226-8447 / 2226-5696
   WhatsApp: 9503-1205
   *Horario de llamadas:* 8:00 AM - 2:00 PM

💡 *Recordatorio importante:*
• El transporte escolar NO está incluido
• Seguro escolar vigente a partir del 10 de febrero
• Promoción especial de matrícula del 17 de noviembre al 31 de diciembre`
            });

            // Enviar menú de grados para selección interactiva
            await delay(1000);
            await enviarMenuGrados(bot, remitente);

          } catch (error) {
            console.error('Error enviando información de matrícula:', error);
            await bot.sendMessage(remitente, {
              text: "❌ Lo siento, hubo un error al cargar la información. Por favor contacta directamente al 9503-1205 para recibir asistencia inmediata."
            });
          }
          break;

        case '2':
          establecerEstado(remitente, 'REGISTRO_ID');
          await enviarMensajeConDelay(bot, remitente, {
            text: '📝 *REGISTRO DE ALUMNO*\n\nPor favor, ingrese el número de identidad del alumno (13 dígitos):'
          });
          break;

        case '3':
          if (alumnos.length === 0) {
            await enviarMensajeConDelay(bot, remitente, {
              text: '❌ No tiene alumnos registrados. Seleccione la opción 2️⃣ para registrar un alumno.'
            });
            await enviarMenuPrincipal(bot, remitente);
          } else if (alumnos.length === 1) {
            const estudiante = await buscarEstudiante(alumnos[0]);
            if (estudiante) {
              await enviarEstadoPagos(bot, remitente, estudiante);
              await delay(15000);
              await enviarMenuPrincipal(bot, remitente);
            } else {
              await enviarMensajeConDelay(bot, remitente, {
                text: '❌ No se encontró información del alumno registrado. Por favor contacte a administración.'
              });
              await enviarMenuPrincipal(bot, remitente);
            }
          } else {
            let mensajeLista = '👨‍👩‍👧‍👦 *SELECCIONE ALUMNO*\n\n';
            let contador = 1;

            for (const idAlumno of alumnos) {
              const estudiante = await buscarEstudiante(idAlumno);
              if (estudiante) {
                mensajeLista += `${contador}. ${estudiante.nombre} - ${estudiante.grado}\n`;
                contador++;
              }
            }

            mensajeLista += '\nResponda con el número del alumno para ver su estado de pagos.';
            establecerEstado(remitente, 'SELECCION_ALUMNO', { alumnos });
            await enviarMensajeConDelay(bot, remitente, { text: mensajeLista });
          }
          break;

        case '4':
          let infoMensaje = `📚 *INFORMACIÓN DE LA ESCUELA*\n\n`;
          infoMensaje += `*${infoEscuela.nombre}*\n\n`;
          infoMensaje += `📍 *Dirección:* ${infoEscuela.direccion}\n`;
          infoMensaje += `📞 *Teléfono:* ${infoEscuela.telefono}\n`;
          infoMensaje += `📧 *Email:* ${infoEscuela.email}\n`;
          infoMensaje += `⏰ *Horario:* ${infoEscuela.horario}\n`;
          infoMensaje += `🌐 *Sitio Web:* ${infoEscuela.sitioWeb}\n\n`;
          infoMensaje += `🏦 *Cuentas Bancarias:*\n`;
          infoMensaje += `⚪ *BAC:* ${infoEscuela.bac}\n`;
          infoMensaje += `⚪ *Occidente:* ${infoEscuela.occidente}\n`;
          infoMensaje += `Escriba *menú* para volver al menú principal.`;

          await enviarMensajeConDelay(bot, remitente, { text: infoMensaje });
          break;

        case '5':
          let contactoMensaje = `📞 *CONTACTAR ADMINISTRACIÓN*\n\n`;
          contactoMensaje += `Para consultas administrativas puede comunicarse al:\n`;
          contactoMensaje += `📱 *WhatsApp:* ${infoEscuela.telefono}\n`;
          contactoMensaje += `📧 *Email:* ${infoEscuela.email}\n\n`;
          contactoMensaje += `⏰ *Horario de atención:*\n`;
          contactoMensaje += `${infoEscuela.horario}\n\n`;
         
          contactoMensaje += `Escriba *menú* para volver al menú principal.`;

          await enviarMensajeConDelay(bot, remitente, { text: contactoMensaje });
          break;

        case '6':
          if (alumnos.length === 0) {
            await enviarMensajeConDelay(bot, remitente, {
              text: '❌ No tiene alumnos registrados para eliminar.'
            });
            await enviarMenuPrincipal(bot, remitente);
          } else {
            let mensajeEliminar = '🗑️ *ELIMINAR ALUMNO*\n\n';
            let contador = 1;

            for (const idAlumno of alumnos) {
              const estudiante = await buscarEstudiante(idAlumno);
              if (estudiante) {
                mensajeEliminar += `${contador}. ${estudiante.nombre} - ${estudiante.grado}\n`;
                contador++;
              }
            }

            mensajeEliminar += '\nResponda con el número del alumno que desea eliminar de su cuenta.';
            establecerEstado(remitente, 'ELIMINAR_ALUMNO', { alumnos });
            await enviarMensajeConDelay(bot, remitente, { text: mensajeEliminar });
          }
          break;

        case '7':
          if (isAdmin(remitente)) {
            establecerEstado(remitente, 'MENU_ADMIN_BROADCAST');
            await enviarMensajeConDelay(bot, remitente, {
              text: '📢 *MENÚ BROADCAST ADMIN*\n\nPor favor, envíe cualquier mensaje (texto, foto, video, etc.) para enviarlo a todos los encargados.\nEscriba *menú* para volver al menú principal.'
            });
          } else {
            await enviarMensajeConDelay(bot, remitente, {
              text: '❌ Opción no válida.'
            });
            await enviarMenuPrincipal(bot, remitente);
          }
          break;

        default:
          // Suppress invalid option message on first message of the day
          if (!esPrimerMensajeDelDia) {
            await enviarMensajeConDelay(bot, remitente, {
              text: '❓ Opción no válida. Por favor seleccione una opción del menú.'
            });
          }
          await enviarMenuPrincipal(bot, remitente);
          break;
      }
      break;

    case 'REGISTRO_ID':
      if (/^\d{13}$/.test(mensaje)) {
        const estudiante = await buscarEstudiante(mensaje);
        if (estudiante) {
          establecerEstado(remitente, 'REGISTRO_PIN', { idEstudiante: mensaje });
          await enviarMensajeConDelay(bot, remitente, {
            text: `✅ *Alumno encontrado:* ${estudiante.nombre}\n\nAhora ingrese el PIN de autorización:`
          });
        } else {
          await enviarMensajeConDelay(bot, remitente, {
            text: '❌ El número de identidad no está registrado en el sistema. Verifique e intente nuevamente.'
          });
        }
      } else {
        await enviarMensajeConDelay(bot, remitente, {
          text: '❌ Formato incorrecto. El número de identidad debe tener 13 dígitos numéricos.\n\nIntente nuevamente o escriba *menú* para volver al menú principal.'
        });
      }
      break;

    case 'REGISTRO_PIN':
      const pinValido = await validarPIN(estado.datos.idEstudiante, mensaje);

      if (pinValido) {
        await registrarEncargado(remitente, estado.datos.idEstudiante);
        const estudiante = await buscarEstudiante(estado.datos.idEstudiante);

        // Log registration event
        appendLog({
          tipo: 'registro',
          fecha: new Date().toISOString(),
          usuario: remitente,
          detalle: `Alumno registrado: ${estado.datos.idEstudiante}`
        });

        await enviarMensajeConDelay(bot, remitente, {
          text: `✅ *REGISTRO EXITOSO*\n\nEl alumno *${estudiante.nombre}* ha sido vinculado a su número.\n\nYa puede consultar su estado de pagos desde el menú principal.`
        });

        setTimeout(() => enviarMenuPrincipal(bot, remitente), 1500);
      } else {
        await enviarMensajeConDelay(bot, remitente, {
          text: '❌ PIN incorrecto. Verifique e intente nuevamente o escriba *menú* para volver al menú principal.'
        });
      }
      break;

    case 'SELECCION_ALUMNO':
      const indice = parseInt(mensaje, 10) - 1;

      if (isNaN(indice) || indice < 0 || indice >= estado.datos.alumnos.length) {
        await enviarMensajeConDelay(bot, remitente, {
          text: '❌ Opción no válida. Por favor seleccione un número de la lista.'
        });
      } else {
        const idAlumno = estado.datos.alumnos[indice];
        const estudiante = await buscarEstudiante(idAlumno);

        if (estudiante) {
          await enviarEstadoPagos(bot, remitente, estudiante);
          setTimeout(() => enviarMenuPrincipal(bot, remitente), 1500);
        } else {
          await enviarMensajeConDelay(bot, remitente, {
            text: '❌ No se encontró información del alumno seleccionado. Por favor contacte a administración.'
          });
          await enviarMenuPrincipal(bot, remitente);
        }
      }
      break;

    case 'ELIMINAR_ALUMNO':
      const indiceEliminar = parseInt(mensaje, 10) - 1;

      if (isNaN(indiceEliminar) || indiceEliminar < 0 || indiceEliminar >= estado.datos.alumnos.length) {
        await enviarMensajeConDelay(bot, remitente, {
          text: '❌ Opción no válida. Por favor seleccione un número de la lista.'
        });
      } else {
        const idAlumno = estado.datos.alumnos[indiceEliminar];
        const estudiante = await buscarEstudiante(idAlumno);

      if (eliminarRelacion(remitente, idAlumno)) {
        // Log deletion event
        appendLog({
          tipo: 'eliminacion',
          fecha: new Date().toISOString(),
          usuario: remitente,
          detalle: `Alumno eliminado: ${idAlumno}`
        });

        await enviarMensajeConDelay(bot, remitente, {
          text: `✅ El alumno *${estudiante.nombre}* ha sido eliminado de su cuenta correctamente.`
        });
      } else {
        await enviarMensajeConDelay(bot, remitente, {
          text: '❌ Error al eliminar el alumno. Por favor contacte a administración.'
        });
      }

        setTimeout(() => enviarMenuPrincipal(bot, remitente), 1500);
      }
      break;

    case 'CONSULTA_ACADEMICA_ID':
      if (/^\d{13}$/.test(mensaje)) {
        const estudiante = await buscarEstudiante(mensaje);
        if (estudiante) {
          await enviarInformacionAcademicaCompleta(bot, remitente, estudiante);
          setTimeout(() => enviarMenuPrincipal(bot, remitente), 1500);
        } else {
          await enviarMensajeConDelay(bot, remitente, {
            text: '❌ El número de identidad no está registrado en el sistema. Verifique e intente nuevamente o escriba *menú* para volver al menú principal.'
          });
        }
      } else {
        await enviarMensajeConDelay(bot, remitente, {
          text: '❌ Formato incorrecto. El número de identidad debe tener 13 dígitos numéricos.\n\nIntente nuevamente o escriba *menú* para volver al menú principal.'
        });
      }
      break;

    case 'esperando_grado':
      const opcionGrado = mensaje.trim();
      if (/^[1-9]$/.test(opcionGrado)) {
        const exito = await enviarInformacionGrado(bot, remitente, opcionGrado);
        if (!exito) {
          // Si falló, volver a mostrar el menú de grados
          await enviarMenuGrados(bot, remitente);
        }
      } else {
        await bot.sendMessage(remitente, {
          text: "❌ Opción no válida. Por favor selecciona un número del 1 al 9."
        });
        await enviarMenuGrados(bot, remitente);
      }
      break;

    case 'consulta_adicional':
      if (mensaje === '1') {
        // Ver otros grados
        await enviarMenuGrados(bot, remitente);
      } else if (mensaje === '2') {
        // Volver al menú principal
        await enviarMenuPrincipal(bot, remitente);
      } else if (mensaje === '3') {
        // Enviar información sobre transporte
        await enviarPDFTransporte(bot, remitente);
        await delay(1000);
        await enviarMenuPrincipal(bot, remitente);
      } else {
        await bot.sendMessage(remitente, {
          text: "❌ Opción no válida. Por favor escribe 1, 2 o 3."
        });
        // Re-enviar la pregunta
        await bot.sendMessage(remitente, {
          text: `✅ *Información enviada correctamente*\n\n¿Deseas consultar información de otro grado?\n\n1️⃣ Sí, ver otros grados\n2️⃣ Volver al menú principal\n3️⃣ Información sobre transporte\n\n📝 *Escribe 1, 2 o 3*`
        });
      }
      break;

    default:
      await enviarMenuPrincipal(bot, remitente);
      break;
  }
}

/**
 * Inicia la conexión del bot WhatsApp.
 */
let qrGenerated = false;
let botInstance = null;
let isConnected = false; // Track connection state

function ensureDataDir() {
  try {
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  } catch (e) {
    console.error('Could not ensure dataDir exists:', e);
  }
}

function logConnectionUpdate(update) {
  ensureDataDir();
  try {
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = path.join(dataDir, `connection_update_${ts}.json`);
    fs.writeFileSync(filename, JSON.stringify({ timestamp: new Date().toISOString(), update }, null, 2));
    // Append a short overview to a rolling log
    const overview = `${new Date().toISOString()} - connection:${update.connection || ''} - qr:${update.qr ? 'yes' : 'no'} - lastDisconnect:${update.lastDisconnect ? (update.lastDisconnect.error?.output?.statusCode || 'unknown') : 'none'}\n`;
    fs.appendFileSync(path.join(dataDir, 'connection_updates.log'), overview);
  } catch (e) {
    console.error('Error logging connection update:', e);
  }
}

function resetQrFlag() {
  qrGenerated = false;
}

// removed rotateBrowserVariant experimental code

async function iniciarBot() {
  try {
    resetQrFlag();

    const clientInstance = await whatsappClient.initClient({ dataDir });

    // Wrap clientInstance to provide a sendMessage signature similar to Baileys used in the project
    botInstance = {
      raw: clientInstance,
      sendMessage: async (chatId, payload) => {
        // Accept existing code patterns: string, { text }, or media objects
        try {
          if (typeof payload === 'string') return await whatsappClient.sendMessage(chatId, payload);
          if (payload && payload.text) return await whatsappClient.sendMessage(chatId, payload.text);

          // If payload looks like a Baileys message object wrapper (e.g., image: Buffer), forward to adapter
          if (payload && payload.image) return await whatsappClient.sendMessage(chatId, { image: payload.image, caption: payload.caption, mimetype: payload.mimetype });
          if (payload && payload.video) return await whatsappClient.sendMessage(chatId, { image: payload.video, caption: payload.caption, mimetype: payload.mimetype });
          if (payload && payload.document) return await whatsappClient.sendMessage(chatId, { document: payload.document, mimetype: payload.mimetype, fileName: payload.fileName });

          // Fallback: try to stringify if it's a plain object with text-like fields
          if (payload && typeof payload === 'object' && (payload.conversation || payload.extendedTextMessage || payload.text)) {
            const text = payload.conversation || (payload.extendedTextMessage && payload.extendedTextMessage.text) || payload.text;
            if (text) return await whatsappClient.sendMessage(chatId, text);
          }

          return Promise.reject(new Error('Unsupported payload for sendMessage'));
        } catch (e) {
          console.error('Error in botInstance.sendMessage adapter:', e);
          throw e;
        }
      },
      logout: async () => {
        try { await whatsappClient.logout(); } catch (e) { console.error('Logout wrapper error', e); }
      }
    };

    // wire events
    whatsappClient.on('qr', (qr) => {
      if (!qrGenerated) {
        qrGenerated = true;
        try { logConnectionUpdate({ qr: true }); } catch (e) {}
      }
    });

    whatsappClient.on('ready', () => {
      console.log('🔔 BOT INICIADO - ESCANEE EL CÓDIGO QR');
      isConnected = true;
    });

    whatsappClient.on('auth_failure', (msg) => {
      console.error('Auth failure from whatsapp-web.js', msg);
      // delete session folder and restart
      const sessionPath = path.join(dataDir, '.wwebjs_auth', 'session');
      try {
        fs.rmSync(path.join(dataDir, '.wwebjs_auth'), { recursive: true, force: true });
      } catch (e) { console.error('Failed removing session on auth_failure', e); }
      setTimeout(iniciarBot, 3000);
    });

    // messages listener
    whatsappClient.on('message', async (message) => {
      try {
        if (!message.from) return;
        // Normalize remitente to WhatsApp jid style used in project
        const remitente = message.from;
        let texto = message.body ? message.body.trim() : '';

        if (texto) {
          await procesarMensaje(botInstance, remitente, texto, message);
        } else if (message.hasMedia) {
          // For media messages, download and pass to procesarMensaje as messageObj
          const media = await whatsappClient.downloadMedia(message);
          const msgObj = {};
          // Create a minimal object resembling Baileys message structure to satisfy enviarBroadcast parsing
          if (media) {
            // guess type
            const lower = (media.mimetype || '').toLowerCase();
            if (lower.startsWith('image/')) msgObj.imageMessage = { caption: message.caption || '' };
            else if (lower.startsWith('video/')) msgObj.videoMessage = { caption: message.caption || '' };
            else if (lower.startsWith('audio/')) msgObj.audioMessage = { mimetype: media.mimetype };
            else msgObj.documentMessage = { mimetype: media.mimetype, fileName: media.filename };
            // attach the media buffer so downloadMediaMessage wrapper code can work
            msgObj._media = media;
          }
          await procesarMensaje(botInstance, remitente, message.caption || '', msgObj);
        }
      } catch (e) {
        console.error('Error processing incoming message', e);
      }
    });
  } catch (error) {
    console.error('Error al iniciar el bot:', error);
  }
}

async function logoutBot() {
  if (botInstance) {
    try {
      await botInstance.logout();
      console.log("Logout exitoso. Sesión cerrada en WhatsApp.");
    } catch (e) {
      console.error("Error durante logout:", e);
    }
  }

  const sessionPath = path.join(dataDir, 'session');
  fs.rm(sessionPath, { recursive: true, force: true }, (err) => {
    if (err) {
      console.error('Error deleting session files:', err);
    } else {
      console.log('Session files deleted successfully.');
    }
    setTimeout(iniciarBot, 3000);
  });
}

module.exports = {
  iniciarBot,
  logoutBot,
  procesarMensaje,
  enviarMenuPrincipal,
  enviarEstadoPagos
};
