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

// Funcție pentru actualizarea unui task
function updateTask(task, callback) {
    const query = 'UPDATE tasks SET name = ?, pomodoros = ? WHERE id = ?';
    db.run(query, [task.name, task.pomodoros, task.id], function (err) {
        if (err) {
            console.error('Error updating task:', err.message);
            return callback(err);
        }
        callback(null);
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

// Funcție pentru ștergerea unui task
function deleteTask(taskId, callback) {
    const query = 'DELETE FROM tasks WHERE id = ?';
    db.run(query, [taskId], function (err) {
        if (err) {
            console.error('Error deleting task:', err.message);
            return callback(err);
        }
        callback(null);
    });
}

// Funcție pentru extragerea timpului total de lucru și pauză în ultima săptămână
function getWeeklySessionTimes(callback) {
    const query = `
        SELECT 
            date(start_time) AS session_date, 
            SUM(CASE WHEN type = 'work' THEN duration ELSE 0 END) AS total_work_time,
            SUM(CASE WHEN type = 'break' THEN duration ELSE 0 END) AS total_break_time,
            COUNT(CASE WHEN type = 'work' THEN 1 ELSE NULL END) AS work_sessions,
            COUNT(CASE WHEN type = 'break' THEN 1 ELSE NULL END) AS break_sessions
        FROM 
            pomodoro_sessions
        WHERE
            date(start_time) >= date('now', '-7 days')
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

// Funcție pentru calcularea consistenței muncii (deviația standard a numărului de sesiuni pe zile)
function calculateWorkConsistency(rows) {
    const sessionCounts = rows.map(row => row.work_sessions);
    const mean = sessionCounts.reduce((a, b) => a + b, 0) / sessionCounts.length;
    const variance = sessionCounts.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / sessionCounts.length;
    return Math.sqrt(variance);
}

// Funcție pentru calcularea rating-ului săptămânal
function calculateWeeklyRating(callback) {
    getWeeklySessionTimes((err, rows) => {
        if (err) {
            return callback(err);
        }

        const totalWorkTime = rows.reduce((sum, row) => sum + row.total_work_time, 0);
        const totalBreakTime = rows.reduce((sum, row) => sum + row.total_break_time, 0);
        const workSessions = rows.reduce((sum, row) => sum + row.work_sessions, 0);
        const averageWorkTime = totalWorkTime / workSessions;
        const breakRatio = totalWorkTime / totalBreakTime;
        const consistency = calculateWorkConsistency(rows);

        const workTimePercentage = (totalWorkTime / (totalWorkTime + totalBreakTime)) * 100;
        const workSessionScore = Math.min((workSessions / 20) * 10, 10);
        const averageWorkTimeScore = Math.min((averageWorkTime / 25) * 10, 10);
        const breakRatioScore = Math.min((4 / breakRatio) * 10, 10);
        const consistencyScore = Math.max(0, 10 - consistency);

        const finalRating = (workSessionScore + averageWorkTimeScore + breakRatioScore + consistencyScore) / 4;

        const explanation = `Work Time Percentage: ${workTimePercentage.toFixed(2)}%
Work Sessions Score: ${workSessionScore.toFixed(2)}
Average Work Time Score: ${averageWorkTimeScore.toFixed(2)}
Break Ratio Score: ${breakRatioScore.toFixed(2)}
Consistency Score: ${consistencyScore.toFixed(2)}`;

        let suggestions = [];
        if (workTimePercentage < 70) {
            suggestions.push("Try to increase your work time percentage by reducing unnecessary breaks.");
        }
        if (workSessions < 20) {
            suggestions.push("Aim to complete more work sessions to maintain consistency.");
        }
        if (averageWorkTime < 20 || averageWorkTime > 25) {
            suggestions.push("Adjust your session durations to be within the 20-25 minute range for optimal productivity.");
        }
        if (breakRatio < 4) {
            suggestions.push("Ensure you are taking adequate breaks to avoid burnout.");
        }
        if (consistency > 2) {
            suggestions.push("Work on maintaining a consistent number of sessions each day to build a routine.");
        }

        callback(null, { rating: finalRating.toFixed(2), explanation, suggestions });
    });
}


module.exports = {
    db,
    getDailySessionTimes,
    getAverageSessionTimes,
    getSessionCountsPerDay,
    addTask,
    updateTask,
    getTasks,
    deleteTask,
    getWeeklySessionTimes,
    calculateWeeklyRating
};
