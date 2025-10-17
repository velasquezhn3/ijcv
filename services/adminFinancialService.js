const { getWorkbook } = require('./studentExcelService');
const moment = require('moment');

// Función mejorada para leer datos de hojas Excel
async function readSheetData(workbook, sheetName) {
  try {
    const worksheet = workbook.getWorksheet(sheetName);
    if (!worksheet) {
      console.warn(`Advertencia: La hoja ${sheetName} no existe en el archivo Excel.`);
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
          // Convertir fechas a formato ISO
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
    console.error(`Error procesando hoja ${sheetName}:`, error);
    return [];
  }
}

// Función para calcular datos financieros de matrículas
function calculateMatriculas(data) {
  const result = {
    total: 0,
    pagado: 0,
    pendiente: 0,
    porMes: {}
  };

  const meses = [
    'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
    'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
  ];

  // Inicializar meses
  meses.forEach(mes => {
    result.porMes[mes] = 0;
  });

  data.forEach(row => {
    // Sumar pagos mensuales
    meses.forEach(mes => {
      const valor = parseFloat(row[mes]) || 0;
      result.pagado += valor;
      result.porMes[mes] = (result.porMes[mes] || 0) + valor;
    });

    // Sumar montos totales
    const matRetrasada = parseFloat(row.MATRETRASADA) || 0;
    const totalPagar = parseFloat(row.TOTALAPAGAR) || 0;
    
    result.total += matRetrasada + totalPagar;
  });

  result.pendiente = result.total - result.pagado;
  return result;
}

// Función para calcular datos de libros
function calculateLibros(data) {
  const result = {
    total: 0,
    pagado: 0,
    pendiente: 0,
    editoriales: {}
  };

  data.forEach(row => {
    const totalPagar = parseFloat(row.TOTALAPAGAR) || 0;
    const editorial = row.EDITORIAL || 'SIN EDITORIAL';
    
    if (totalPagar > 0) {
      result.total += totalPagar;
      
      if (row.ESTADO === 'PAGADO') {
        result.pagado += totalPagar;
        result.editoriales[editorial] = (result.editoriales[editorial] || 0) + totalPagar;
      } else {
        result.pendiente += totalPagar;
      }
    }
  });

  return result;
}

// Función para calcular datos de transporte
function calculateTransporte(data) {
  const result = {
    total: 0,
    pagado: 0,
    pendiente: 0,
    porMes: {}
  };

  const meses = {
    'MARZO': 'MARZO',
    'ABRIL': 'ABRIL',
    'MAYO': 'MAYO',
    'JUNIO': 'JUNIO',
    'JULIO': 'JULIO',
    'AGOSTO': 'AGOSTO',
    'SEPT': 'SEPTIEMBRE',
    'OCT': 'OCTUBRE',
    'NOV': 'NOVIEMBRE',
    'DIC': 'DICIEMBRE'
  };

  data.forEach(row => {
    const sumaAport = parseFloat(row.SUMAAPORT) || 0;
    result.total += sumaAport;
    result.pagado += sumaAport;

    // Sumar por mes
    Object.entries(meses).forEach(([col, mes]) => {
      const valor = parseFloat(row[col]) || 0;
      result.porMes[mes] = (result.porMes[mes] || 0) + valor;
    });
  });

  result.pendiente = result.total - result.pagado;
  return result;
}

// Función para calcular la distribución de ingresos
function calculateIncomeDistribution(matriculas, libros, transporte) {
  const total = matriculas.total + libros.total + transporte.total;
  
  return {
    matriculas: total ? ((matriculas.total / total) * 100).toFixed(2) : '0.00',
    libros: total ? ((libros.total / total) * 100).toFixed(2) : '0.00',
    transporte: total ? ((transporte.total / total) * 100).toFixed(2) : '0.00'
  };
}

// Función principal mejorada
async function getFinancialDashboard() {
  try {
    const workbook = await getWorkbook();

    // Read all relevant sheets with more detailed data extraction
    const matriculasData = await readSheetData(workbook, 'MATRICULA 2025');
    const editorialesData = await readSheetData(workbook, 'EDITORIALES 2025');
    const transporteData = await readSheetData(workbook, 'INGRESO TES 2025');

    // Additional sheets for more data if needed
    const preciosLibrosData = await readSheetData(workbook, 'PRECIO VENTA LIBROS');
    const entregaPaquetesData = await readSheetData(workbook, 'ENTREGA 1 PAQUTES LIBROS');

    // Calculate financial data
    const matriculas = calculateMatriculas(matriculasData);
    const libros = calculateLibros(editorialesData);
    const transporte = calculateTransporte(transporteData);

    // Calculate income distribution
    const distribucionIngresos = calculateIncomeDistribution(matriculas, libros, transporte);

    // Prepare enriched response with additional data
    return {
      resumenGeneral: {
        matriculas,
        libros,
        transporte,
        totalGeneral: matriculas.total + libros.total + transporte.total
      },
      distribucion: distribucionIngresos,
      seriesTemporales: {
        matriculas: matriculas.porMes,
        transporte: transporte.porMes
      },
      detalleEditoriales: libros.editoriales,
      preciosLibros: preciosLibrosData,
      entregaPaquetes: entregaPaquetesData,
      metadata: {
        ultimaActualizacion: moment().format(),
        totalRegistros: {
          matriculas: matriculasData.length,
          libros: editorialesData.length,
          transporte: transporteData.length,
          preciosLibros: preciosLibrosData.length,
          entregaPaquetes: entregaPaquetesData.length
        }
      }
    };

  } catch (error) {
    console.error('Error generando dashboard financiero:', error);
    return {
      error: 'No se pudo generar el dashboard financiero',
      detalle: error.message
    };
  }
}

async function getFinancialSummary() {
  return await getFinancialDashboard();
}

module.exports = {
  getFinancialSummary
};
