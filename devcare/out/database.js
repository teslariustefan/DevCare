const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'devcare.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    db.run(`
      CREATE TABLE IF NOT EXISTS pomodoro_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        duration INTEGER NOT NULL,
        type TEXT NOT NULL
      )
    `, (err) => {
      if (err) {
        console.error('Error creating table:', err.message);
      }
    });
  }
});

module.exports = db;
