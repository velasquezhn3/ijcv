const express = require('express');
const path = require('path');
const fs = require('fs');

const router = express.Router();

const logsFilePath = path.join(__dirname, '../data/logs.json');

const financialService = require('../services/adminFinancialService');
const { getFinancialSummary } = require('../services/adminFinancialService');

function readLogs() {
  try {
    if (fs.existsSync(logsFilePath)) {
      const data = fs.readFileSync(logsFilePath, 'utf8');
      if (data) {
        return JSON.parse(data);
      }
    }
    return [];
  } catch (error) {
    console.error('Error reading logs:', error);
    return [];
  }
}

function groupByPeriod(logs, tipo, period) {
  // period: 'day', 'week', 'month'
  const counts = {};

  logs.forEach(log => {
    if (log.tipo !== tipo) return;

    const date = new Date(log.fecha);
    let key = '';

    if (period === 'day') {
      key = date.toISOString().slice(0, 10);
    } else if (period === 'week') {
      // Get ISO week number
      const tempDate = new Date(date.getTime());
      tempDate.setHours(0, 0, 0, 0);
      tempDate.setDate(tempDate.getDate() + 4 - (tempDate.getDay() || 7));
      const yearStart = new Date(tempDate.getFullYear(), 0, 1);
      const weekNo = Math.ceil((((tempDate - yearStart) / 86400000) + 1) / 7);
      key = `${tempDate.getFullYear()}-W${weekNo.toString().padStart(2, '0')}`;
    } else if (period === 'month') {
      key = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
    }

    counts[key] = (counts[key] || 0) + 1;
  });

  return counts;
}

function groupUsersByPeriod(logs, period) {
  // Return number of distinct users active by period
  const usersByPeriod = {};

  logs.forEach(log => {
    if (log.tipo !== 'mensaje') return;

    const date = new Date(log.fecha);
    let key = '';

    if (period === 'day') {
      key = date.toISOString().slice(0, 10);
    } else if (period === 'week') {
      const tempDate = new Date(date.getTime());
      tempDate.setHours(0, 0, 0, 0);
      tempDate.setDate(tempDate.getDate() + 4 - (tempDate.getDay() || 7));
      const yearStart = new Date(tempDate.getFullYear(), 0, 1);
      const weekNo = Math.ceil((((tempDate - yearStart) / 86400000) + 1) / 7);
      key = `${tempDate.getFullYear()}-W${weekNo.toString().padStart(2, '0')}`;
    } else if (period === 'month') {
      key = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
    }

    if (!usersByPeriod[key]) {
      usersByPeriod[key] = new Set();
    }
    usersByPeriod[key].add(log.usuario);
  });

  // Convert sets to counts
  const counts = {};
  for (const key in usersByPeriod) {
    counts[key] = usersByPeriod[key].size;
  }
  return counts;
}

function groupRegistrationsByPeriod(logs, period) {
  // Return registrations and deletions counts by period
  const registrations = {};
  const deletions = {};

  logs.forEach(log => {
    if (log.tipo !== 'registro' && log.tipo !== 'eliminacion') return;

    const date = new Date(log.fecha);
    let key = '';

    if (period === 'day') {
      key = date.toISOString().slice(0, 10);
    } else if (period === 'week') {
      const tempDate = new Date(date.getTime());
      tempDate.setHours(0, 0, 0, 0);
      tempDate.setDate(tempDate.getDate() + 4 - (tempDate.getDay() || 7));
      const yearStart = new Date(tempDate.getFullYear(), 0, 1);
      const weekNo = Math.ceil((((tempDate - yearStart) / 86400000) + 1) / 7);
      key = `${tempDate.getFullYear()}-W${weekNo.toString().padStart(2, '0')}`;
    } else if (period === 'month') {
      key = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
    }

    if (log.tipo === 'registro') {
      registrations[key] = (registrations[key] || 0) + 1;
    } else if (log.tipo === 'eliminacion') {
      deletions[key] = (deletions[key] || 0) + 1;
    }
  });

  return { registrations, deletions };
}

// Helper to parse period query param and default to 'day'
function parsePeriod(req) {
  const period = req.query.period;
  if (period === 'week' || period === 'month') {
    return period;
  }
  return 'day';
}

router.get('/messages', (req, res) => {
  const period = parsePeriod(req);
  const logs = readLogs();
  const counts = groupByPeriod(logs, 'mensaje', period);
  res.json(counts);
});

router.get('/financial-summary', async (req, res) => {
  try {
    const summary = await getFinancialSummary();
    res.json(summary);
  } catch (error) {
    console.error('Error fetching financial summary:', error);
    res.status(500).json({ error: 'Error fetching financial summary' });
  }
});

router.get('/users', (req, res) => {
  const period = parsePeriod(req);
  const logs = readLogs();
  const counts = groupUsersByPeriod(logs, period);
  res.json(counts);
});

router.get('/registrations', (req, res) => {
  const period = parsePeriod(req);
  const logs = readLogs();
  const counts = groupRegistrationsByPeriod(logs, period);
  res.json(counts);
});

router.get('/messages/total', (req, res) => {
  const logs = readLogs();
  const totalMessages = logs.filter(log => log.tipo === 'mensaje').length;
  res.json({ total: totalMessages });
});

router.get('/financial-summary', async (req, res) => {
  try {
    const summary = await getFinancialSummary();
    res.json(summary);
  } catch (error) {
    console.error('Error fetching financial summary:', error);
    res.status(500).json({ error: 'Error fetching financial summary' });
  }
});

module.exports = router;
