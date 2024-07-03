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

        db.run(`
            CREATE TABLE IF NOT EXISTS tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                pomodoros INTEGER NOT NULL
            )
        `, (err) => {
            if (err) {
                console.error('Error creating tasks table:', err.message);
            } else {
                cleanUpInvalidTasks();
            }
        });
    }
});

// Funcție pentru curățarea task-urilor cu valori greșite
function cleanUpInvalidTasks() {
    const query = 'DELETE FROM tasks WHERE pomodoros < 1';
    db.run(query, [], (err) => {
        if (err) {
            console.error('Error cleaning up invalid tasks:', err.message);
        } else {
            console.log('Invalid tasks cleaned up successfully.');
        }
    });
}

// Funcție pentru extragerea timpului total petrecut în sesiuni de lucru și pauză grupate pe zile
function getDailySessionTimes(callback) {
    const query = `
        SELECT 
            date(start_time) AS session_date, 
            SUM(CASE WHEN type = 'work' THEN duration ELSE 0 END) AS total_work_time,
            SUM(CASE WHEN type = 'break' THEN duration ELSE 0 END) AS total_break_time
        FROM 
            pomodoro_sessions
        GROUP BY 
            session_date
        ORDER BY 
            session_date;
    `;
    
    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('Error executing SQL query:', err.message);
            return callback(err);
        }
        callback(null, rows);
    });
}

// Funcție pentru extragerea timpului mediu petrecut în sesiuni de lucru și pauză
function getAverageSessionTimes(callback) {
    const query = `
        SELECT 
            AVG(CASE WHEN type = 'work' THEN duration ELSE NULL END) AS avg_work_time,
            AVG(CASE WHEN type = 'break' THEN duration ELSE NULL END) AS avg_break_time
        FROM 
            pomodoro_sessions;
    `;
    
    db.get(query, [], (err, row) => {
        if (err) {
            console.error('Error executing SQL query:', err.message);
            return callback(err);
        }
        callback(null, row);
    });
}

// Funcție pentru extragerea numărului de sesiuni de lucru și pauză grupate pe zile
function getSessionCountsPerDay(callback) {
    const query = `
        SELECT 
            date(start_time) AS session_date, 
            COUNT(CASE WHEN type = 'work' THEN 1 ELSE NULL END) AS work_sessions,
            COUNT(CASE WHEN type = 'break' THEN 1 ELSE NULL END) AS break_sessions
        FROM 
            pomodoro_sessions
        GROUP BY 
            session_date
        ORDER BY 
            session_date;
    `;
    
    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('Error executing SQL query:', err.message);
            return callback(err);
        }
        callback(null, rows);
    });
}

// Funcție pentru adăugarea unui task
function addTask(task, callback) {
    const query = 'INSERT INTO tasks (name, pomodoros) VALUES (?, ?)';
    db.run(query, [task.name, task.pomodoros], function (err) {
        if (err) {
            console.error('Error adding task:', err.message);
            return callback(err);
        }
        callback(null, { id: this.lastID });
    });
}

// Funcție pentru extragerea task-urilor
function getTasks(callback) {
    const query = 'SELECT * FROM tasks';
    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('Error fetching tasks:', err.message);
            return callback(err);
        }
        callback(null, rows);
    });
}

module.exports = {
    db,
    getDailySessionTimes,
    getAverageSessionTimes,
    getSessionCountsPerDay,
    addTask,
    getTasks
};
