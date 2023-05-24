const vscode = require('vscode');

let myStatusBarItem;
let reminderInterval;
let timeRemaining;
let isPaused = false; // Control variable
let isFinished = false;
let isPomodoro = false;
let pomodoroState = 'work';
let pomodoroCycle = 0;
let wasPaused = false;
let isRunning = false; // This will be true when either timer is running

function activate(context) {
    myStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    myStatusBarItem.command = 'devcare.showDashboard';
    myStatusBarItem.text = "$(watch) Activate DevCare Dashboard";
    myStatusBarItem.show();

    context.subscriptions.push(
        vscode.commands.registerCommand('devcare.showDashboard', () => {
            const panel = vscode.window.createWebviewPanel(
                'DevcareDashboard',
                'DevCare Dashboard',
                vscode.ViewColumn.One,
                {
                    enableScripts: true
                }
            );

            panel.webview.onDidReceiveMessage(
                message => {
                    switch (message.command) {
                        case 'setReminder':
                            // Allow resetting the timer if a normal timer is already running
                            if (!isRunning || !isPomodoro) {
                                resetTimer(message.time, panel.webview);
                                isRunning = true;
                            }
                            return;
                        case 'startPomodoro':
                            // Only start the Pomodoro timer if no timer is currently running
                            if (!isRunning) {
                                startPomodoro(panel.webview);
                                isRunning = true;
                            }
                            return;
                        case 'pauseReminder':
                            pauseReminder();
                            return;
                        case 'startReminder':
                            if (wasPaused) {
                                setReminder(timeRemaining / 60, panel.webview);
                                wasPaused = false;
                            }
                            return;
                        case 'stopReminder':
                            stopReminder(); // Stop and reset everything
                            return;
                    }
                },
                undefined,
                context.subscriptions
            );

            panel.webview.html = getWebviewContent();
        })
    );
}

function getWebviewContent() {
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>DevCare Dashboard</title>
    </head>
    <body>
        <h1>Welcome to DevCare Dashboard!</h1>
        <input id="timeInput" type="number" min="1" value="60" />
        <button id="reminderButton">Set reminder for break</button>
        <button id="pomodoroButton">Start Pomodoro Technique</button>
        <button id="pauseButton">Pause</button> <!-- Adaugam butonul de pauza -->
        <button id="startButton">Start</button> <!-- Adaugam butonul de start -->
        <button id="stopButton">Switch timer</button> <!-- Adaugam butonul de stop -->
        <p id="timeRemaining"></p>

        <script>
            const vscode = acquireVsCodeApi();
            const timeInput = document.getElementById('timeInput');
            const timeRemaining = document.getElementById('timeRemaining');

            document.getElementById('reminderButton').addEventListener('click', () => {
                vscode.postMessage({
                    command: 'setReminder',
                    time: timeInput.value
                });
            });

            document.getElementById('pomodoroButton').addEventListener('click', () => {
                vscode.postMessage({
                    command: 'startPomodoro'
                });
            });

            document.getElementById('pauseButton').addEventListener('click', () => { // Ascultator pentru butonul de pauza
                vscode.postMessage({
                    command: 'pauseReminder'
                });
            });

            document.getElementById('startButton').addEventListener('click', () => { // Ascultator pentru butonul de start
                vscode.postMessage({
                    command: 'startReminder'
                });
            });

            document.getElementById('stopButton').addEventListener('click', () => {
                vscode.postMessage({
                    command: 'stopReminder'
                });
            });

            window.addEventListener('message', event => {
				const message = event.data;
				switch (message.command) {
					case 'updateTime':
						if (message.time <= 0) {
							timeRemaining.textContent = 'The timer has finished!';
						} else {
							const minutes = Math.floor(message.time / 60);
							const seconds = message.time % 60;
							timeRemaining.textContent = \`Time remaining: \${minutes} minutes and \${seconds} seconds\`;
						}
						break;
				}
			});
        </script>
    </body>
    </html>`;
}

function setReminder(time, webview) {
    if (!isPaused && !isFinished) { 
        timeRemaining = parseInt(time) * 60;
        vscode.window.showInformationMessage('Timer started!'); // notificare la inceputul timer-ului normal
    }

    else if(isPaused && !isFinished)
    {
        vscode.window.showInformationMessage('Timer resumed!'); // notificare la reinceperea timer-ului normal
    }

    isPaused = false;
    wasPaused = false;

    // Do not restart the timer if it has already finished
    if (isFinished) {
        return;
    }

    if (reminderInterval) {
        clearInterval(reminderInterval);
    }

    reminderInterval = setInterval(() => {
        if (isPaused) { // Check if it's paused
            return;
        }
    
        if (timeRemaining <= 0) {
            if (isPomodoro) {
                if (pomodoroState === 'work') {
                    if (pomodoroCycle === 4) {
                        pomodoroCycle = 0; // Reset the cycle
                        vscode.window.showInformationMessage('Great work! Take a long break!');
                    } else {
                        pomodoroCycle++;
                        vscode.window.showInformationMessage('Work period finished! Time for a short break!');
                        pomodoroState = 'break';
                    }
                } else {
                    vscode.window.showInformationMessage('Break finished! Time to get back to work!');
                    pomodoroState = 'work';
                }
                setPomodoroTime(webview);
            } else {
                isFinished = true; 
                vscode.window.showInformationMessage('Time for a break! Move a bit!');
                clearInterval(reminderInterval);
            }
        }
        
        webview.postMessage({
            command: 'updateTime',
            time: timeRemaining
        });
        timeRemaining--;
    }, 1000); // Update the countdown every second
}

function startPomodoro(webview) {
    isPomodoro = true;
    pomodoroCycle = 0;
    pomodoroState = 'work';
    setPomodoroTime(webview);
}

function setPomodoroTime(webview) {
    if (pomodoroState === 'work') {
        resetTimer(25, webview);
    } else {
        resetTimer(5, webview);
    }
}

function resetTimer(time, webview) {
    timeRemaining = parseInt(time) * 60;  // Reset the time
    isPaused = false;  // Reset the paused state
    isFinished = false;  // Reset the finished state
    setReminder(time, webview);  // Call the setReminder function
}

function pauseReminder() {
    isPaused = true; 
    wasPaused = true; // Memoram faptul ca timerul a fost pus pe pauza
    vscode.window.showInformationMessage('Timer paused!'); // notificare la apasarea butonului de pauza
}

function stopReminder() {
    // Clear the interval and reset everything
    if (reminderInterval) {
        clearInterval(reminderInterval);
        reminderInterval = null;
        timeRemaining = null;
        isPaused = false;
        isFinished = false;
        isPomodoro = false;
        pomodoroState = 'work';
        pomodoroCycle = 0;
        wasPaused = false;
        isRunning = false; // No timer is running now
        vscode.window.showInformationMessage('The previous timer was stopped. You can now choose to restart any of the two timers.'); //notificare atunci cand butonul switch timer este apasat
    }
}

module.exports = {
    activate
}
