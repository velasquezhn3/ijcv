const fs = require('fs');
const path = require('path');
const { encargadosFilePath, dataDir } = require('../config/config');
const { buscarEstudiante, calcularDeuda } = require('./studentService');

/**
 * Reads encargados data from JSON file.
 * Returns an object with keys as encargado IDs and values as user data.
 * If file missing, returns empty object.
 */
function readEncargadosData() {
  try {
    if (fs.existsSync(encargadosFilePath)) {
      const data = fs.readFileSync(encargadosFilePath, 'utf8');
      return JSON.parse(data).encargados || {};
    }
  } catch (error) {
    console.error('Error reading encargados data:', error);
  }
  return {};
}

/**
 * Filters encargados by filters: name, id, active.
 * Since encargados.json structure is unknown, assume keys are IDs and values have 'nombre' and 'activo' fields.
 * Active can be inferred if the encargado has linked students.
 */
async function getUsers(filters) {
  const encargados = readEncargadosData();
  let users = Object.entries(encargados).map(([id, data]) => ({
    id,
    nombre: data.nombre || '',
    activo: data.activo !== undefined ? data.activo : (data.alumnos && data.alumnos.length > 0),
    alumnos: data.alumnos || []
  }));

  if (filters.nombre) {
    const nombreLower = filters.nombre.toLowerCase();
    users = users.filter(u => u.nombre.toLowerCase().includes(nombreLower));
  }
  if (filters.id) {
    users = users.filter(u => u.id.includes(filters.id));
  }
  if (filters.activo !== undefined) {
    const activoBool = filters.activo === 'true';
    users = users.filter(u => u.activo === activoBool);
  }

  return users;
}

/**
 * Loads all students from Excel by reading all rows.
 * Returns array of student objects with id, nombre, grado, payment status.
 * Filters by name, id, payment status.
 */
async function getStudents(filters) {
  // Load all students by reading the Excel sheet rows
  const students = [];
  try {
    const workbook = await require('./studentExcelService').getWorkbook();
    let sheet = workbook.getWorksheet('MATRICULA 2025');
    if (!sheet) {
      sheet = workbook.worksheets[0];
    }
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber < 3) return; // skip header rows
      const id = row.getCell('F').value?.toString() || '';
      const nombre = row.getCell('A').value || '';
      const grado = row.getCell('B').value || '';
      const estudiante = {
        id,
        nombre,
        grado
      };
      students.push(estudiante);
    });
  } catch (error) {
    console.error('Error loading students:', error);
  }

  // Filter students by name and id
  let filtered = students;
  if (filters.nombre) {
    const nombreLower = filters.nombre.toLowerCase();
    filtered = filtered.filter(s => s.nombre.toLowerCase().includes(nombreLower));
  }
  if (filters.id) {
    filtered = filtered.filter(s => s.id.includes(filters.id));
  }

  // Filter by payment status if requested
  if (filters.estadoPago) {
    // estadoPago can be 'pagado' or 'deudor'
    const estadoPago = filters.estadoPago.toLowerCase();
    const filteredByPago = [];
    const now = new Date();
    const currentMonth = now.getMonth() + 1; // 1-based month number
    for (const s of filtered) {
      try {
        const estudiante = await buscarEstudiante(s.id);
        if (!estudiante) continue;
        const deuda = calcularDeuda(estudiante);
        let alDia = deuda.alDia;

        // Treat students who only owe the current month as "pagados" in panel
        const mesesPendientes = deuda.mesesPendientes.map(m => m.toLowerCase());
        if (mesesPendientes.length === 1) {
          // Map month names to numbers for comparison
          const monthNameToNumber = {
            enero: 1,
            febrero: 2,
            marzo: 3,
            abril: 4,
            mayo: 5,
            junio: 6,
            julio: 7,
            agosto: 8,
            septiembre: 9,
            octubre: 10,
            noviembre: 11,
            diciembre: 12
          };
          const pendienteMonthNum = monthNameToNumber[mesesPendientes[0]];
          if (pendienteMonthNum === currentMonth) {
            alDia = true; // Treat as paid
          }
        }

        if ((estadoPago === 'pagado' && alDia) || (estadoPago === 'deudor' && !alDia)) {
          filteredByPago.push(s);
        }
      } catch (error) {
        console.error('Error calculating deuda for student', s.id, error);
      }
    }
    filtered = filteredByPago;
  }

  return filtered;
}

/**
 * Reads logs.json and filters logs by user ID.
 * Returns logs sorted chronologically ascending.
 */
async function getUserHistory(id) {
  try {
    const logsPath = path.join(dataDir, 'logs.json');
    if (!fs.existsSync(logsPath)) {
      return [];
    }
    const data = fs.readFileSync(logsPath, 'utf8');
    const logs = JSON.parse(data);
    const filteredLogs = logs.filter(log => log.usuario && log.usuario.includes(id));
    filteredLogs.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
    return filteredLogs;
  } catch (error) {
    console.error('Error reading logs:', error);
    return [];
  }
}

module.exports = {
  getUsers,
  getStudents,
  getUserHistory
};
