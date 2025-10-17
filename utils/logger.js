const fs = require('fs');
const path = require('path');

const logsFilePath = path.join(__dirname, '../data/logs.json');

function appendLog(logEntry) {
  try {
    let logs = [];
    if (fs.existsSync(logsFilePath)) {
      const data = fs.readFileSync(logsFilePath, 'utf8');
      if (data) {
        logs = JSON.parse(data);
      }
    }
    logs.push(logEntry);
    fs.writeFileSync(logsFilePath, JSON.stringify(logs, null, 2), 'utf8');
  } catch (error) {
    console.error('Error writing log entry:', error);
  }
}

module.exports = {
  appendLog
};
