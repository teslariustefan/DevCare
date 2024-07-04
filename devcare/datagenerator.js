const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Calea către baza de date
const dbPath = path.join(__dirname, 'devcare.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to the database.');
        resetPomodoroSessions();
    }
});

// Funcție pentru resetarea valorilor din tabela pomodoro_sessions
function resetPomodoroSessions() {
    const deleteQuery = 'DELETE FROM pomodoro_sessions';
    db.run(deleteQuery, (err) => {
        if (err) {
            console.error('Error deleting data from pomodoro_sessions:', err.message);
        } else {
            console.log('pomodoro_sessions table has been reset.');
            insertGeneratedData();
        }
    });
}

// Funcție pentru generarea de date noi și inserarea lor în baza de date
function insertGeneratedData() {
    const dates = generateDateRange("2024-06-01", "2024-06-30");
    const workDurations = [25, 30, 45, 60];
    const breakDurations = [5, 10, 15, 20];
    const data = [];

    dates.forEach(date => {
        let currentTime = new Date(`${date}T08:00:00`);
        const endTime = new Date(`${date}T17:00:00`);

        while (currentTime < endTime) {
            const workDuration = getRandomElement(workDurations);
            const workEndTime = new Date(currentTime.getTime() + workDuration * 60000);
            if (workEndTime > endTime) break;
            data.push({
                start_time: currentTime.toISOString(),
                end_time: workEndTime.toISOString(),
                duration: workDuration,
                type: 'work'
            });

            currentTime = workEndTime;

            const breakDuration = getRandomElement(breakDurations);
            const breakEndTime = new Date(currentTime.getTime() + breakDuration * 60000);
            if (breakEndTime > endTime) break;
            data.push({
                start_time: currentTime.toISOString(),
                end_time: breakEndTime.toISOString(),
                duration: breakDuration,
                type: 'break'
            });

            currentTime = breakEndTime;
        }
    });

    insertDataToDatabase(data);
}

// Funcție pentru generarea unui interval de date
function generateDateRange(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const dateArray = [];

    while (start <= end) {
        dateArray.push(new Date(start).toISOString().split('T')[0]);
        start.setDate(start.getDate() + 1);
    }

    return dateArray;
}

// Funcție pentru obținerea unui element aleatoriu dintr-o listă
function getRandomElement(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

// Funcție pentru inserarea datelor în baza de date
function insertDataToDatabase(data) {
    const insertQuery = `
        INSERT INTO pomodoro_sessions (start_time, end_time, duration, type)
        VALUES (?, ?, ?, ?)
    `;

    db.serialize(() => {
        const stmt = db.prepare(insertQuery);

        data.forEach(row => {
            stmt.run(row.start_time, row.end_time, row.duration, row.type);
        });

        stmt.finalize((err) => {
            if (err) {
                console.error('Error inserting data:', err.message);
            } else {
                console.log('Data inserted successfully.');
            }
            db.close();
        });
    });
}
