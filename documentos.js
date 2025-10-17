/**
 * documentos.js
 * 
 * Consolidated WhatsApp connection logic using Baileys library.
 * 
 * This module handles:
 * - Baileys initial configuration
 * - WhatsApp connection setup and management
 * - QR code generation and authentication
 * - Session and credential management
 * - Connection event handling (connect, disconnect, reconnect)
 * - Error handling
 * - Auxiliary functions to maintain connection
 * 
 * Dependencies:
 * - @whiskeysockets/baileys
 * - qrcode-terminal
 * - qrcode
 * - fs
 * - path
 */

/* Imports */
const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const qrcodeTerminal = require('qrcode-terminal');
const qrcode = require('qrcode');
const fs = require('fs');
const path = require('path');

/* Configuration */
const dataDir = path.join(__dirname, 'data'); // Directory to store session and QR code data

/* Variables to track connection state */
let qrGenerated = false;
let botInstance = null;
let isConnected = false;

/**
 * Reset the QR code generated flag.
 * Used internally to allow new QR code generation on reconnect.
 */
function resetQrFlag() {
  qrGenerated = false;
}

/**
 * Main function to initiate WhatsApp connection using Baileys.
 * Handles authentication, connection events, QR code generation, and message events.
 * 
 * @returns {Promise<Object>} The bot instance (makeWASocket)
 */
async function iniciarBot() {
  try {
    resetQrFlag();

    // Use multi-file auth state to manage session credentials
    const { state, saveCreds } = await useMultiFileAuthState(path.join(dataDir, 'session'));

    // Create the WhatsApp socket connection
    // `printQRInTerminal` deprecated. Handle QR through 'connection.update' event instead.
    // Fetch latest WA Web version to avoid handshake/405 issues.
    let waVersion = [2, 2300, 0];
    try {
      const latest = await fetchLatestBaileysVersion();
      if (Array.isArray(latest) && latest.length >= 3) {
        waVersion = latest;
        console.log('Using latest WA Web version:', waVersion);
      }
    } catch (err) {
      console.warn('Could not fetch latest WA Web version, using fallback:', waVersion, err?.message || err);
    }

    botInstance = makeWASocket({
      auth: state,
      version: waVersion,
      browser: ["Sistema Escolar", "Chrome", "122.0.6261.94"],
      mobile: false,
      // explicitly disable the deprecated terminal QR printing to silence warnings
      printQRInTerminal: false
    });

    // Listen for connection updates (QR code, connection status, disconnects)
    botInstance.ev.on('connection.update', (update) => {
      console.log('Connection update event:', JSON.stringify(update, null, 2));
      if (update.qr) {
        if (!qrGenerated) {
          qrGenerated = true;
          console.log('QR code event received');
          console.log('QR code received, scan please:');
          qrcodeTerminal.generate(update.qr, { small: true });

          // Save QR code as text file
          const qrFilePath = path.join(dataDir, 'qr_code.txt');
          qrcodeTerminal.generate(update.qr, { small: true }, (qrString) => {
            fs.writeFile(qrFilePath, qrString, (err) => {
              if (err) {
                console.error('Error saving QR code to file:', err);
              } else {
                console.log(`QR code saved to file: ${qrFilePath}`);
              }
            });
          });

          // Save QR code as PNG file
          const qrPngPath = path.join(dataDir, 'qr_code.png');
          qrcode.toFile(qrPngPath, update.qr, { type: 'png' }, (err) => {
            if (err) {
              console.error('Error generating QR code PNG:', err);
            } else {
              console.log(`QR code PNG saved to file: ${qrPngPath}`);
            }
          });

          // Log QR code data URL
          qrcode.toDataURL(update.qr, (err, url) => {
            if (err) {
              console.error('Error generating QR code data URL:', err);
            } else {
              console.log('QR code data URL:', url);
            }
          });
        } else {
          console.log('QR code already generated, skipping duplicate generation.');
        }
      }
      if (update.connection) {
        console.log('Connection update:', update.connection);
        isConnected = update.connection === 'open';
      }
      if (update.lastDisconnect) {
        console.log('Last disconnect info:', JSON.stringify(update.lastDisconnect, null, 2));
        const statusCode = update.lastDisconnect.error?.output?.statusCode || update.lastDisconnect.statusCode;
        console.log('Last disconnect status code:', statusCode);

        if (statusCode === 440) {
          console.log('Conflict detected: another instance is connected with this WhatsApp number. Bot will not restart. Close other instances to resume.');
          return; // Prevent restart on conflict
        }

        if (statusCode === 401) {
          console.log('Unauthorized, deleting session and restarting...');
          const sessionPath = path.join(dataDir, 'session');
          fs.rm(sessionPath, { recursive: true, force: true }, (err) => {
            if (err) {
              console.error('Error deleting session files:', err);
            } else {
              console.log('Session files deleted successfully.');
            }
            setTimeout(iniciarBot, 3000);
          });
          return; // Prevent further restart until deletion completes
        }

        if (statusCode === 405) {
          console.warn('Received 405 Method Not Allowed during registration. Backing off and retrying in 10s.');
          setTimeout(iniciarBot, 10000);
          return;
        }
      }
      if (update.connection === 'close') {
        console.log('Connection closed, restarting bot in 3 seconds...');
        isConnected = false;
        setTimeout(iniciarBot, 3000);
      }
    });

    // Listen for credential updates to save them
    botInstance.ev.on('creds.update', saveCreds);

    // Listen for new messages and process them
    botInstance.ev.on('messages.upsert', async ({ messages }) => {
      const msg = messages[0];
      if (!msg.key.fromMe && msg.message) {
        const remitente = msg.key.remoteJid;
        let texto = '';

        if (msg.message.conversation) {
          texto = msg.message.conversation.trim();
        } else if (msg.message.extendedTextMessage) {
          texto = msg.message.extendedTextMessage.text.trim();
        }

        if (texto) {
          // Placeholder for message processing function
          // await procesarMensaje(botInstance, remitente, texto, msg.message);
          console.log(`Received message from ${remitente}: ${texto}`);
        }
      }
    });

    console.log('🔔 BOT STARTED - SCAN THE QR CODE');
    return botInstance;
  } catch (error) {
    console.error('Error starting bot:', error);
    throw error;
  }
}

/**
 * Logout and clear session data.
 * Logs out the bot and deletes session files to force re-authentication.
 */
async function logoutBot() {
  if (botInstance) {
    try {
      await botInstance.logout();
      console.log("Logout successful. WhatsApp session closed.");
    } catch (e) {
      console.error("Error during logout:", e);
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

/* Export the module */
module.exports = {
  iniciarBot,
  logoutBot,
  resetQrFlag
};
