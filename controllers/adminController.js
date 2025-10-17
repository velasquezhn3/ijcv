const adminUserService = require('../services/adminUserService');
const { buscarEstudiante, calcularDeuda } = require('../services/studentService');


/**
 * List encargados (users) with optional filters.
 */
async function listUsers(req, res) {
  try {
    const filters = req.query;
    const users = await adminUserService.getUsers(filters);
    res.json(users);
  } catch (error) {
    console.error('Error listing users:', error);
    res.status(500).json({ error: 'Error listing users' });
  }
}

/**
 * List students with optional filters.
 */
async function listStudents(req, res) {
  try {
    const filters = req.query;
    const students = await adminUserService.getStudents(filters);
    res.json(students);
  } catch (error) {
    console.error('Error listing students:', error);
    res.status(500).json({ error: 'Error listing students' });
  }
}

/**
 * Get user or student action history by ID.
 */
async function getUserHistory(req, res) {
  try {
    const id = req.params.id;
    const history = await adminUserService.getUserHistory(id);
    res.json(history);
  } catch (error) {
    console.error('Error getting user history:', error);
    res.status(500).json({ error: 'Error getting user history' });
  }
}

async function getStudentDebt(req, res) {
  try {
    const id = req.params.id;
    const estudiante = await buscarEstudiante(id);
    if (!estudiante) {
      return res.status(404).json({ error: 'Estudiante no encontrado' });
    }
    const deuda = calcularDeuda(estudiante);
    res.json({ estudiante, deuda });
  } catch (error) {
    console.error('Error getting student debt:', error);
    res.status(500).json({ error: 'Error getting student debt' });
  }
}

module.exports = {
  listUsers,
  listStudents,
  getUserHistory,
  getStudentDebt
};
