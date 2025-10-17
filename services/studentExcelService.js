/**
 * Módulo para descargar y cachear el archivo Excel desde un enlace público.
 * Implementa descarga directa con axios, parseo con exceljs,
 * caché en memoria con actualización automática cada 60 minutos,
 * manejo de errores con reintentos y logging con timestamps.
 */

const axios = require('axios');
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

let EXCEL_URL = 'https://www.dropbox.com/scl/fi/ib25r1mh25ybbfrh15e6e/CUENTAS-A-O-2025-IJCV.xlsx?rlkey=l0a61b5yg8c8mf50mfmaf9xak&st=heqb9ldm&dl=1';
const CACHE_REFRESH_INTERVAL = 60 * 60 * 1000; // 60 minutos
const MAX_RETRIES = 3;

let cachedWorkbook = null;
let lastFetchTime = 0;

/**
 * Función para descargar el archivo Excel desde la URL pública con reintentos.
 */
async function downloadExcelWithRetry(url, retries = MAX_RETRIES) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`[${new Date().toISOString()}] Intentando descargar archivo Excel (intento ${attempt})...`);
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 15000, // 15 segundos timeout
        headers: {
          'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/octet-stream'
        }
      });
      // Validar que el contenido recibido sea un archivo Excel (xlsx)
      const contentType = response.headers['content-type'];
      if (!contentType || (!contentType.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') && !contentType.includes('application/binary'))) {
        throw new Error(`Tipo de contenido inesperado: ${contentType}`);
      }
      console.log(`[${new Date().toISOString()}] Descarga exitosa.`);
      return response.data;
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error en descarga intento ${attempt}: ${error.message}`);
      if (attempt === retries) {
        throw new Error('No se pudo descargar el archivo Excel después de varios intentos.');
      }
      // Esperar 2 segundos antes del siguiente intento
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}

/**
 * Función para validar si un buffer es un archivo Excel válido.
 * Intenta cargar el buffer con exceljs y captura errores.
 * @param {Buffer} buffer - Buffer del archivo Excel.
 * @returns {Promise<boolean>} true si es válido, false si no.
 */
async function validarBufferExcel(buffer) {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer);
    return true;
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error al validar buffer Excel: ${error.message}`);
    return false;
  }
}

/**
 * Función para cargar y parsear el archivo Excel desde el buffer con reintentos.
 * @param {Buffer} buffer - Buffer del archivo Excel.
 * @param {number} retries - Número de reintentos.
 * @returns {Promise<ExcelJS.Workbook>} Workbook cargado.
 */
async function loadWorkbook(buffer, retries = MAX_RETRIES) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);
      return workbook;
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error al cargar workbook (intento ${attempt}): ${error.message}`);
      if (attempt === retries) {
        throw new Error('No se pudo cargar el archivo Excel después de varios intentos.');
      }
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}

/**
 * Función para cargar un archivo Excel desde ruta local con validaciones.
 * @param {string} filePath - Ruta del archivo local.
 * @returns {Promise<ExcelJS.Workbook>} Workbook cargado.
 */
async function loadWorkbookFromFile(filePath) {
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('La ruta del archivo debe ser una cadena no vacía.');
  }
  const ext = path.extname(filePath).toLowerCase();
  if (ext !== '.xlsx') {
    throw new Error('Solo se soportan archivos .xlsx. Por favor convierta el archivo .xls a .xlsx.');
  }
  if (!fs.existsSync(filePath)) {
    throw new Error(`El archivo no existe en la ruta especificada: ${filePath}`);
  }
  const buffer = fs.readFileSync(filePath);
  const esValido = await validarBufferExcel(buffer);
  if (!esValido) {
    throw new Error('El archivo Excel está corrupto o no es válido.');
  }
  return await loadWorkbook(buffer);
}

/**
 * Función para obtener el workbook cacheado, actualizando si es necesario.
 */
async function getWorkbook() {
  const now = Date.now();
  if (!cachedWorkbook || (now - lastFetchTime) > CACHE_REFRESH_INTERVAL) {
    console.log(`[${new Date().toISOString()}] Actualizando caché del archivo Excel...`);
    const buffer = await downloadExcelWithRetry(EXCEL_URL);
    const esValido = await validarBufferExcel(buffer);
    if (!esValido) {
      throw new Error('El archivo descargado está corrupto o no es un archivo Excel válido.');
    }
    cachedWorkbook = await loadWorkbook(buffer);
    lastFetchTime = now;
    console.log(`[${new Date().toISOString()}] Caché actualizada.`);

    // Log all sheet names for debugging
    console.log('Hojas disponibles en el workbook:');
    cachedWorkbook.worksheets.forEach((sheet, index) => {
      console.log(`  [${index + 1}] ${sheet.name}`);
    });
  } else {
    console.log(`[${new Date().toISOString()}] Usando caché existente del archivo Excel.`);
  }
  return cachedWorkbook;
}

/**
 * Función para actualizar la URL del archivo Excel y resetear la caché.
 * @param {string} newUrl - Nueva URL para el archivo Excel.
 */
function setExcelUrl(newUrl) {
  if (typeof newUrl === 'string' && newUrl.trim() !== '') {
    EXCEL_URL = newUrl.trim();
    cachedWorkbook = null;
    lastFetchTime = 0;
    console.log(`[${new Date().toISOString()}] URL del archivo Excel actualizada a: ${EXCEL_URL}`);
  } else {
    throw new Error('La nueva URL debe ser una cadena no vacía.');
  }
}

module.exports = {
  getWorkbook,
  setExcelUrl,
  loadWorkbookFromFile
};
