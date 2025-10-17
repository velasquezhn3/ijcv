const express = require('express');
const router = express.Router();

const { analyzeDashboardData } = require('../services/financialDashboardService');

router.get('/dashboard-data', async (req, res) => {
  try {
    const dashboardData = await analyzeDashboardData();
    res.json(dashboardData);
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

module.exports = router;
