const { getWorkbook } = require('./studentExcelService');
const moment = require('moment');

/**
 * Reads sheet data and returns JSON array of rows with normalized keys.
 */
async function readSheetData(workbook, sheetName) {
  try {
    const worksheet = workbook.getWorksheet(sheetName);
    if (!worksheet) {
      console.warn(`Warning: Sheet ${sheetName} does not exist in Excel file.`);
      return [];
    }

    const headerRow = worksheet.getRow(1);
    const columns = new Map();

    headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      if (cell.value) {
        const key = cell.value.toString().trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
        columns.set(colNumber, key);
      }
    });

    const jsonData = [];
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return;

      const rowData = {};
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const key = columns.get(colNumber);
        if (key) {
          if (cell.value instanceof Date) {
            rowData[key] = moment(cell.value).toISOString();
          } else {
            rowData[key] = cell.value;
          }
        }
      });
      jsonData.push(rowData);
    });

    return jsonData;
  } catch (error) {
    console.error(`Error processing sheet ${sheetName}:`, error);
    return [];
  }
}

/**
 * Performs comprehensive analysis of the Excel data for dashboard.
 */
async function analyzeDashboardData() {
  try {
    const workbook = await getWorkbook();

    // Read all relevant sheets
    const sheetsToRead = [
      'MATRICULA 2025',
      'EDITORIALES 2025',
      'INGRESO TES 2025',
      'PRECIO VENTA LIBROS',
      'ENTREGA 1 PAQUTES LIBROS',
      'TRATO BANDA',
      'VIAJE AL CAJON',
      'VIAJE A LA TIGRA',
      'VIAJE A PUERTO CORTES'
    ];

    const data = {};
    for (const sheetName of sheetsToRead) {
      data[sheetName] = await readSheetData(workbook, sheetName);
    }

    // Begin detailed analysis

    // Total students
    const totalStudents = data['MATRICULA 2025'].length;

    // Distribution by level, year, gender
    const distribution = {
      level: {},
      year: {},
      gender: {}
    };

    data['MATRICULA 2025'].forEach(student => {
      const level = student.NIVEL || 'Desconocido';
      const year = student.CICLO || 'Desconocido';
      const gender = student.SEXO || 'Desconocido';

      distribution.level[level] = (distribution.level[level] || 0) + 1;
      distribution.year[year] = (distribution.year[year] || 0) + 1;
      distribution.gender[gender] = (distribution.gender[gender] || 0) + 1;
    });

    // Financial stats
    let totalDebt = 0;
    let studentsWithDebt = 0;
    let debtAmounts = [];

    data['MATRICULA 2025'].forEach(student => {
      const debt = parseFloat(student.DEUDA) || 0;
      totalDebt += debt;
      if (debt > 0) {
        studentsWithDebt++;
        debtAmounts.push(debt);
      }
    });

    const averageDebt = studentsWithDebt ? totalDebt / studentsWithDebt : 0;
    const minDebt = debtAmounts.length ? Math.min(...debtAmounts) : 0;
    const maxDebt = debtAmounts.length ? Math.max(...debtAmounts) : 0;

    // Top 10 debtors
    const topDebtors = data['MATRICULA 2025']
      .filter(s => parseFloat(s.DEUDA) > 0)
      .sort((a, b) => parseFloat(b.DEUDA) - parseFloat(a.DEUDA))
      .slice(0, 10);

    // Morosity and payments
    const morosityRate = totalStudents ? (studentsWithDebt / totalStudents) * 100 : 0;

    // Days overdue histogram (assuming field DIAS_ATRASO)
    const daysOverdueHistogram = {};
    data['MATRICULA 2025'].forEach(student => {
      const days = parseInt(student.DIAS_ATRASO) || 0;
      const bucket = days > 60 ? '+60' : days > 30 ? '31-60' : days > 0 ? '1-30' : '0';
      daysOverdueHistogram[bucket] = (daysOverdueHistogram[bucket] || 0) + 1;
    });

    // Monthly payments vs debts (assuming fields PAGOS_MES_1 ... PAGOS_MES_12 and DEUDA_TOTAL)
    // This requires more detailed data, skipping for now.

    // Segmentation by status
    const segmentation = {
      alDia: 0,
      morosos_1_30: 0,
      morosos_31_60: 0,
      morosos_60mas: 0,
      conBeca: 0
    };

    data['MATRICULA 2025'].forEach(student => {
      const days = parseInt(student.DIAS_ATRASO) || 0;
      if (days === 0) segmentation.alDia++;
      else if (days <= 30) segmentation.morosos_1_30++;
      else if (days <= 60) segmentation.morosos_31_60++;
      else segmentation.morosos_60mas++;

      if (student.BECA && student.BECA.toLowerCase() === 'si') segmentation.conBeca++;
    });

    return {
      metadata: {
        lastUpdated: moment().format(),
        sheetNames: sheetsToRead,
        recordCounts: sheetsToRead.reduce((acc, name) => {
          acc[name] = data[name].length;
          return acc;
        }, {})
      },
      data,
      analysis: {
        totalStudents,
        distribution,
        totalDebt,
        studentsWithDebt,
        averageDebt,
        minDebt,
        maxDebt,
        topDebtors,
        morosityRate,
        daysOverdueHistogram,
        segmentation
      }
    };
  } catch (error) {
    console.error('Error analyzing dashboard data:', error);
    return {
      error: 'Failed to analyze dashboard data',
      details: error.message
    };
  }
}

module.exports = {
  analyzeDashboardData
};
