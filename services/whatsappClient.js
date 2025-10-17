const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const qrcodeTerminal = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');

let client = null;
let dataDir = path.join(__dirname, '..', 'data');

function ensureDataDir() {
  try {
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  } catch (e) {
    console.error('Could not ensure dataDir exists:', e);
  }
}

async function initClient(options = {}) {
  ensureDataDir();
  dataDir = options.dataDir || dataDir;

  client = new Client({
    authStrategy: new LocalAuth({ clientId: options.clientId || 'session' }),
    puppeteer: options.puppeteer || { headless: true }
  });

  client.on('qr', (qr) => {
    console.log('QR received');
    qrcodeTerminal.generate(qr, { small: true });
    // save PNG and text versions
    try {
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      const pngPath = path.join(dataDir, `qr_code_${ts}.png`);
      qrcode.toFile(pngPath, qr, { type: 'png' }, (err) => {
        if (err) console.error('Error saving QR png', err);
        else console.log('QR saved to', pngPath);
      });
      const txtPath = path.join(dataDir, `qr_code_${ts}.txt`);
      qrcodeTerminal.generate(qr, { small: true }, (s) => fs.writeFileSync(txtPath, s));
    } catch (e) { console.error('QR save failed', e); }
  });

  client.on('ready', () => {
    console.log('WhatsApp client ready');
  });

  client.on('auth_failure', (msg) => {
    console.error('Auth failure', msg);
  });

  client.on('disconnected', (reason) => {
    console.log('WhatsApp client disconnected:', reason);
  });

  await client.initialize();
  return client;
}

function on(event, fn) {
  if (!client) throw new Error('Client not initialized');
  client.on(event, fn);
}

async function sendMessage(chatId, payload) {
  if (!client) throw new Error('Client not initialized');
  // payload can be string or an object { text } or { image: Buffer, caption }
  if (typeof payload === 'string') return client.sendMessage(chatId, payload);

  if (payload && payload.text) return client.sendMessage(chatId, payload.text);

  if (payload && payload.image) {
    const base64 = payload.image.toString('base64');
    const mime = payload.mimetype || 'image/jpeg';
    const media = new MessageMedia(mime, base64);
    return client.sendMessage(chatId, media, { caption: payload.caption || '' });
  }

  if (payload && payload.document) {
    const base64 = payload.document.toString('base64');
    const mime = payload.mimetype || 'application/octet-stream';
    const media = new MessageMedia(mime, base64, payload.fileName || 'file');
    return client.sendMessage(chatId, media, { sendMediaAsDocument: true });
  }

  return Promise.reject(new Error('Unsupported payload'));
}

async function downloadMedia(message) {
  // message is a whatsapp-web.js Message instance
  if (!message) return null;
  if (!message.hasMedia) return null;
  const media = await message.downloadMedia();
  // media.data is base64
  const buffer = Buffer.from(media.data, 'base64');
  return { buffer, mimetype: media.mimetype, filename: media.filename };
}

async function logout() {
  if (!client) return;
  try {
    await client.logout();
  } catch (e) {
    console.error('Logout error', e);
  }
}

module.exports = {
  initClient,
  on,
  sendMessage,
  downloadMedia,
  logout
};
