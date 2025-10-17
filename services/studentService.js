/**
 * Servicio para manejo de datos de estudiantes.
 */

const ExcelJS = require('exceljs');
const { columnas } = require('../config/config');
const { getWorkbook } = require('./studentExcelService');

/**
 * Sanitiza y convierte un valor de celda a número o null.
 * @param {any} valor - Valor de la celda.
 * @returns {number|null} Valor numérico o null si no es válido.
 */
function sanitizarValorMes(valor) {
  if (valor === null || valor === undefined) return null;

  if (typeof valor === 'number') return valor;

  if (typeof valor === 'string') {
    // Eliminar símbolos de moneda, espacios y comas
    const limpio = valor.replace(/[^0-9.-]+/g, '');
    const numero = parseFloat(limpio);
    return isNaN(numero) ? null : numero;
  }

  if (typeof valor === 'object') {
    if (valor.text) {
      const limpio = valor.text.replace(/[^0-9.-]+/g, '');
      const numero = parseFloat(limpio);
      return isNaN(numero) ? null : numero;
    }
    if (valor.result) {
      return typeof valor.result === 'number' ? valor.result : null;
    }
  }

  return null;
}

/**
 * Busca un estudiante por su ID en el archivo Excel.
 * @param {string} id - ID del estudiante.
 * @returns {Promise<Object|null>} Información del estudiante o null si no encontrado.
 */
async function buscarEstudiante(id) {
  try {
    // Obtener el workbook cacheado desde el nuevo módulo
    const workbook = await getWorkbook();

    // Obtener la hoja "MATRICULA 2025" (hoja número 0)
    // Intentar obtener por nombre, si no existe, obtener por índice (0)
    let hoja = workbook.getWorksheet('MATRICULA 2025');
    if (!hoja) {
      hoja = workbook.worksheets[0]; // índice 0 = hoja número 1 (0-based)
      console.log(`[${new Date().toISOString()}] Hoja "MATRICULA 2025" no encontrada por nombre, usando hoja número 1: ${hoja.name}`);
    }

    let estudiante = null;

    hoja.eachRow((row, rowNumber) => {
      if (rowNumber < 3) return;
      if (row.getCell(columnas.ID).value?.toString() === id) {
        const valorCelda = row.getCell(columnas.TOTAL_PAGAR).value;
        let totalPagar = 0;

        if (typeof valorCelda === 'number') {
          totalPagar = valorCelda;
        } else if (typeof valorCelda === 'string') {
          const numeroLimpio = valorCelda.replace(/[^0-9.]/g, '');
          totalPagar = parseFloat(numeroLimpio) || 0;
        } else if (valorCelda && typeof valorCelda === 'object') {
          if (valorCelda.text) {
            const numeroLimpio = valorCelda.text.replace(/[^0-9.]/g, '');
            totalPagar = parseFloat(numeroLimpio) || 0;
          } else if (valorCelda.result) {
            totalPagar = valorCelda.result;
          }
        }

        if (valorCelda && typeof valorCelda === 'string' && valorCelda.includes(',')) {
          const numeroLimpio = valorCelda
            .replace('L.', '')
            .replace('L', '')
            .replace(/\s/g, '')
            .replace(',', '');
          totalPagar = parseFloat(numeroLimpio) || 0;
        }

        estudiante = {
          nombre: row.getCell(columnas.NOMBRE).value,
          grado: row.getCell(columnas.GRADO).value,
          id,
          planDePago: row.getCell('H').value,  // Added planDePago from column H
          meses: Object.entries(columnas.MESES).reduce((acc, [mes, col]) => {
            acc[mes.toLowerCase()] = sanitizarValorMes(row.getCell(col).value);
            return acc;
          }, {}),
          totalPagar,
          valorCeldaOriginal: valorCelda
        };
      }
    });

    return estudiante;
  } catch (error) {
    console.error('Error en buscarEstudiante:', error);
    if (error.message.includes('No se pudo cargar el archivo Excel') || error.message.includes('corrupto')) {
      throw new Error('Error al cargar el archivo Excel. Por favor, verifique que el archivo no esté corrupto y sea un archivo .xlsx válido.');
    }
    throw error;
  }
}

/**
 * Calcula la deuda actual de un estudiante.
 * @param {Object} estudiante - Objeto estudiante con información de pagos.
 * @returns {Object} Detalles de deuda y estado de pagos.
 */
function calcularDeuda(estudiante) {
  const ahora = new Date();
  const diaActual = ahora.getDate();
  const mesActual = ahora.getMonth() + 1;
  const anioActual = ahora.getFullYear();

  const meses = Object.keys(columnas.MESES).map((mes, index) => ({
    nombre: mes.toLowerCase(),
    num: index + 1
  }));

  // Determine starting month based on planDePago
  const inicioMes = estudiante.planDePago === 10 ? 2 : 1;

  // Filter months to check for pending payments starting from inicioMes to mesActual
  const mesesPendientes = meses
    .filter(m => m.num >= inicioMes && m.num <= mesActual)
    .filter(m => {
      const valor = estudiante.meses[m.nombre];
      return !valor || valor.toString().trim() === '';
    });

  // Calculate mora (late fee)
  let deudaMora = 0;
  const cuotaMensual = estudiante.totalPagar;

  mesesPendientes.forEach(mesPendiente => {
    // Calculate the due date plus 10 days for the month
    // Due date is the 1st of the next month + 10 days grace period
    let anioMes = anioActual;
    let mesNum = mesPendiente.num;
    // If the month is December and current month is January, adjust year accordingly
    if (mesNum === 12 && mesActual === 1) {
      anioMes = anioActual - 1;
    }
    const fechaVencimiento = new Date(anioMes, mesNum, 11); // month is 0-based, so mesNum is next month index

    if (ahora > fechaVencimiento) {
      deudaMora += cuotaMensual * 0.05;
    }
  });

  const deudaMensualidad = cuotaMensual * mesesPendientes.length;
  const totalDeuda = deudaMensualidad + deudaMora;

  return {
    deudaMensualidad: deudaMensualidad.toFixed(2),
    deudaMora: deudaMora.toFixed(2),
    totalDeuda: totalDeuda.toFixed(2),
    mesesPendientes: mesesPendientes.map(m => m.nombre.toUpperCase()),
    cuotaMensual: cuotaMensual.toFixed(2),
    alDia: mesesPendientes.length === 0
  };
}

module.exports = {
  buscarEstudiante,
  calcularDeuda
};
