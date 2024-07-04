const vscode = require('vscode');
const axios = require('axios');
const { authenticateWithGitHub, fetchGitHubUserData } = require('./auth/github');
const { getWebviewContent } = require('./webviewContent');
const { getLoginViewContent } = require('./loginView');
const { db, getDailySessionTimes, getAverageSessionTimes, getSessionCountsPerDay, addTask, getTasks, updateTask, deleteTask, calculateWeeklyRating } = require('./database');

let myStatusBarItem;
let reminderInterval;
let timeRemaining;
let isPaused = false;
let isFinished = false;
let isPomodoro = false;
let pomodoroState = 'work';
let pomodoroCycle = 0;
let wasPaused = false;
let isRunning = false;
let dashboardPanel;
let loginPanel;
let extensionContext;
let automatedTimerConfig = {};
let currentTaskId = null;

function activate(context) {
    extensionContext = context;
    initializeStatusBarItem(context);
    registerCommands(context);

    restoreState();

    if (isRunning) {
        setReminder(timeRemaining / 60, null);
    }

    // Calculate and show rating on activation
    calculateAndShowRating();
}

function initializeStatusBarItem(context) {
    myStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    myStatusBarItem.command = 'devcare.showLogin';
    myStatusBarItem.text = "$(watch) Activate DevCare Dashboard";
    myStatusBarItem.show();
    context.subscriptions.push(myStatusBarItem);
}

function registerCommands(context) {
    context.subscriptions.push(
        vscode.commands.registerCommand('devcare.showDashboard', showDashboard),
        vscode.commands.registerCommand('devcare.showLogin', showLogin),
        vscode.commands.registerCommand('devcare.authenticateWithGitHub', authenticateWithGitHub),
        vscode.commands.registerCommand('devcare.fetchGitHubData', fetchGitHubData),
        vscode.commands.registerCommand('devcare.startPomodoro', (taskId) => startPomodoro(taskId)),
        vscode.commands.registerCommand('devcare.endPomodoro', endPomodoro),
        vscode.commands.registerCommand('devcare.addTask', addNewTask),
        vscode.commands.registerCommand('devcare.startAutomatedTimer', startAutomatedTimer)
    );
}

function showLogin() {
    if (loginPanel) {
        loginPanel.reveal(vscode.ViewColumn.One);
    } else {
        loginPanel = vscode.window.createWebviewPanel(
            'DevcareLogin',
            'DevCare Login',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
            }
        );

        loginPanel.onDidDispose(
            () => {
                loginPanel = undefined;
            },
            null,
            extensionContext.subscriptions
        );

        loginPanel.webview.onDidReceiveMessage(handleLoginMessage(loginPanel.webview), undefined);
        loginPanel.webview.html = getLoginViewContent();
    }
}

function handleLoginMessage(webview) {
    return async message => {
        switch (message.command) {
            case 'authenticateWithGitHub':
                try {
                    await authenticateWithGitHub();
                    const userData = await fetchGitHubUserNameWithRetry();
                    console.log('Fetched user data:', userData);

                    if (userData) {
                        await vscode.workspace.getConfiguration('devcare').update('githubUser', userData, vscode.ConfigurationTarget.Global);
                        vscode.window.showInformationMessage('Successfully authenticated with GitHub!');
                        showDashboard();
                    } else {
                        vscode.window.showErrorMessage('Failed to fetch user name after multiple attempts.');
                    }
                } catch (error) {
                    vscode.window.showErrorMessage('Failed to authenticate with GitHub after multiple attempts.');
                }
                break;
            case 'continueAsGuest':
                await vscode.workspace.getConfiguration('devcare').update('githubAccessToken', undefined, vscode.ConfigurationTarget.Global);
                await vscode.workspace.getConfiguration('devcare').update('githubUser', undefined, vscode.ConfigurationTarget.Global);
                showDashboard();
                break;
        }
    };
}

async function fetchGitHubUserNameWithRetry(retries = 5, delay = 1000) {
    let userData = null;
    while (retries > 0 && !userData) {
        try {
            userData = await fetchGitHubUserName();
        } catch (error) {
            if (retries === 1) {
                console.error('Failed to fetch user name:', error);
            }
        }
        if (!userData) {
            await new Promise(resolve => setTimeout(resolve, delay));
            retries--;
        }
    }
    return userData;
}

async function fetchGitHubUserName() {
    const token = vscode.workspace.getConfiguration().get('devcare.githubAccessToken');
    if (!token) {
        return null;
    }

    try {
        const userData = await fetchGitHubUserData(token);
        console.log('Fetched GitHub user data:', userData);
        return userData;
    } catch (error) {
        console.error('Error fetching GitHub user data:', error);
        throw error;
    }
}

function showDashboard() {
    if (loginPanel) {
        loginPanel.dispose();
    }
    if (dashboardPanel) {
        dashboardPanel.reveal(vscode.ViewColumn.One);
    } else {
        dashboardPanel = vscode.window.createWebviewPanel(
            'DevcareDashboard',
            'DevCare Dashboard',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
            }
        );

        dashboardPanel.onDidDispose(
            () => {
                dashboardPanel = undefined;
            },
            null,
            extensionContext.subscriptions
        );

        dashboardPanel.webview.onDidReceiveMessage(handleWebviewMessage(dashboardPanel.webview), undefined);
        const config = vscode.workspace.getConfiguration('devcare');
        const githubUser = config.get('githubUser') || {};
        console.log('Showing dashboard with user data:', githubUser);
        dashboardPanel.webview.html = getWebviewContent(githubUser);

        sendCurrentStateToWebview(dashboardPanel.webview);
        sendSessionTimesToWebview(dashboardPanel.webview);
        sendAverageSessionTimesToWebview(dashboardPanel.webview);
        sendSessionCountsToWebview(dashboardPanel.webview);
        updateTasks();

        // Calculate and send rating to webview
        calculateAndShowRating();
    }
}

function handleWebviewMessage(webview) {
    return async message => {
        switch (message.command) {
            case 'setReminder':
                if (!isRunning || !isPomodoro) {
                    resetTimer(message.time, webview);
                    isRunning = true;
                }
                break;
            case 'startPomodoro':
                if (!isRunning) {
                    startPomodoro(message.taskId, webview);
                    isRunning = true;
                }
                break;
            case 'pauseReminder':
                pauseReminder();
                break;
            case 'startReminder':
                if (wasPaused) {
                    setReminder(timeRemaining / 60, webview);
                    wasPaused = false;
                }
                break;
            case 'stopReminder':
                stopReminder();
                break;
            case 'authenticateWithGitHub':
                try {
                    await authenticateWithGitHub();
                    const userData = await fetchGitHubUserName();
                    if (userData) {
                        updateUserName(webview, userData);
                        updateUserInfo(webview, userData);
                    } else {
                        vscode.window.showErrorMessage('Failed to fetch user name.');
                    }
                } catch (error) {
                    vscode.window.showErrorMessage('Failed to authenticate with GitHub.');
                }
                break;
            case 'addTask':
                addNewTask(message.task);
                break;
            case 'deleteTask':
                deleteTask(message.taskId, (err) => {
                    if (err) {
                        vscode.window.showErrorMessage('Failed to delete task.');
                    } else {
                        updateTasks();
                    }
                });
                break;
            case 'editTask':
                editTask(message.task, (err) => {
                    if (err) {
                        vscode.window.showErrorMessage('Failed to edit task.');
                    } else {
                        updateTasks();
                    }
                });
                break;
            case 'startAutomatedTimer':
                startAutomatedTimer(message.level, webview);
                break;
        }
    };
}

function sendCurrentStateToWebview(webview) {
    const config = vscode.workspace.getConfiguration('devcare');
    const token = config.get('githubAccessToken');
    const githubUser = config.get('githubUser');
    const state = {
        timeRemaining,
        isPaused,
        isFinished,
        isPomodoro,
        pomodoroState,
        pomodoroCycle,
        wasPaused,
        isRunning,
        githubUser: token ? githubUser : null,
        currentTaskId
    };
    webview.postMessage({ command: 'updateState', state });
}

function updateUserName(webview, userData) {
    webview.postMessage({
        command: 'updateUserName',
        userName: userData.login,
        avatarUrl: userData.avatar_url
    });
}

function updateUserInfo(webview, userData) {
    webview.postMessage({
        command: 'updateUserInfo',
        public_repos: userData.public_repos,
        private_repos: userData.total_private_repos,
        total_stars: userData.total_stars,
        followers: userData.followers,
        following: userData.following,
        recentCommits: userData.recentCommits,
        recentIssues: userData.recentIssues,
        recentPRs: userData.recentPRs
    });
}

async function fetchGitHubData() {
    const token = vscode.workspace.getConfiguration().get('devcare.githubAccessToken');
    if (!token) {
        vscode.window.showErrorMessage('Not authenticated. Please authenticate with GitHub first.');
        return;
    }

    try {
        const response = await axios.get('https://api.github.com/user', {
            headers: { Authorization: `token ${token}` }
        });
        vscode.window.showInformationMessage(`GitHub User: ${response.data.login}`);
    } catch (error) {
        vscode.window.showErrorMessage('Failed to fetch data from GitHub');
        console.error(error);
    }
}

function saveState() {
    const config = vscode.workspace.getConfiguration('devcare');
    config.update('state', {
        timeRemaining,
        isPaused,
        isFinished,
        isPomodoro,
        pomodoroState,
        pomodoroCycle,
        wasPaused,
        isRunning,
        automatedTimerConfig,
        currentTaskId
    }, vscode.ConfigurationTarget.Global);
}

function restoreState() {
    const config = vscode.workspace.getConfiguration('devcare');
    const savedState = config.get('state');
    if (savedState) {
        timeRemaining = savedState.timeRemaining;
        isPaused = savedState.isPaused;
        isFinished = savedState.isFinished;
        isPomodoro = savedState.isPomodoro;
        pomodoroState = savedState.pomodoroState;
        pomodoroCycle = savedState.pomodoroCycle;
        wasPaused = savedState.wasPaused;
        isRunning = savedState.isRunning;
        automatedTimerConfig = savedState.automatedTimerConfig || {};
        currentTaskId = savedState.currentTaskId;

        if (isRunning) {
            setReminder(timeRemaining / 60, null);
        }
    }
}

function addNewTask(task) {
    addTask(task, (err, result) => {
        if (err) {
            vscode.window.showErrorMessage('Failed to add task.');
        } else {
            updateTasks();
        }
    });
}

function editTask(task, callback) {
    updateTask(task, (err) => {
        if (err) {
            console.error('Error editing task:', err.message);
            return callback(err);
        }
        callback(null);
    });
}

function updateTasks() {
    getTasks((err, rows) => {
        if (err) {
            vscode.window.showErrorMessage('Failed to fetch tasks.');
        } else {
            if (dashboardPanel) {
                dashboardPanel.webview.postMessage({ command: 'updateTasks', tasks: rows });
            }
        }
    });
}

function startAutomatedTimer(level, webview) {
    let workTime, shortBreak, longBreak, cycles;

    switch (level) {
        case 'easy':
            workTime = 20;
            shortBreak = 5;
            longBreak = 15;
            cycles = 4;
            break;
        case 'medium':
            workTime = 35;
            shortBreak = 5;
            longBreak = 20;
            cycles = 4;
            break;
        case 'hard':
            workTime = 50;
            shortBreak = 10;
            longBreak = 30;
            cycles = 4;
            break;
        default:
            vscode.window.showErrorMessage('Invalid difficulty level');
            return;
    }

    automatedTimerConfig = {
        workTime,
        shortBreak,
        longBreak,
        cycles,
        currentCycle: 0,
        state: 'work'
    };

    isRunning = true;
    setAutomatedTimer(webview);
}

function setAutomatedTimer(webview) {
    const { workTime, shortBreak, longBreak, cycles, currentCycle, state } = automatedTimerConfig;

    let time;
    if (state === 'work') {
        time = workTime;
        automatedTimerConfig.state = 'shortBreak';
    } else if (state === 'shortBreak') {
        time = shortBreak;
        automatedTimerConfig.currentCycle++;
        automatedTimerConfig.state = automatedTimerConfig.currentCycle < cycles ? 'work' : 'longBreak';
    } else if (state === 'longBreak') {
        time = longBreak;
        automatedTimerConfig.currentCycle = 0;
        automatedTimerConfig.state = 'work';
    }

    resetAutomatedTimer(time, webview);
}

function resetAutomatedTimer(time, webview) {
    timeRemaining = time * 60;
    isPaused = false;
    isFinished = false;
    setAutomatedReminder(time, webview);
}

function setAutomatedReminder(time, webview) {
    if (!isPaused && !isFinished) {
        timeRemaining = parseInt(time) * 60;
        vscode.window.showInformationMessage('Automated Timer started!');
    } else if (isPaused && !isFinished) {
        vscode.window.showInformationMessage('Automated Timer resumed!');
    }

    isPaused = false;
    wasPaused = false;

    if (isFinished) return;

    if (reminderInterval) clearInterval(reminderInterval);

    reminderInterval = setInterval(() => {
        if (isPaused) return;

        if (timeRemaining <= 0) {
            handleAutomatedTimerFinish(webview);
        } else {
            if (dashboardPanel) {
                dashboardPanel.webview.postMessage({ command: 'updateTime', time: timeRemaining });
            }
            timeRemaining--;
        }
    }, 1000);
    saveState();
}

function handleAutomatedTimerFinish(webview) {
    const { currentCycle, cycles, state } = automatedTimerConfig;

    if (state === 'work') {
        vscode.window.showInformationMessage('Work period finished! Time for a short break!');
    } else if (state === 'shortBreak') {
        if (currentCycle < cycles) {
            vscode.window.showInformationMessage('Short break finished! Time to get back to work!');
        } else {
            vscode.window.showInformationMessage('Great work! Time for a long break!');
        }
    } else if (state === 'longBreak') {
        vscode.window.showInformationMessage('Long break finished! Time to get back to work!');
    }

    if (state !== 'longBreak') {
        setAutomatedTimer(webview);
    } else {
        isFinished = true;
        clearInterval(reminderInterval);
    }

    saveState();
}

function setReminder(time, webview) {
    if (!isPaused && !isFinished) {
        timeRemaining = parseInt(time) * 60;
        vscode.window.showInformationMessage('Timer started!');
    } else if (isPaused && !isFinished) {
        vscode.window.showInformationMessage('Timer resumed!');
    }

    isPaused = false;
    wasPaused = false;

    if (isFinished) return;

    if (reminderInterval) clearInterval(reminderInterval);

    reminderInterval = setInterval(() => {
        if (isPaused) return;

        if (timeRemaining <= 0) {
            handleTimerFinish(webview);
        } else {
            if (dashboardPanel) {
                dashboardPanel.webview.postMessage({ command: 'updateTime', time: timeRemaining });
            }
            timeRemaining--;
        }
    }, 1000);
    saveState();
}

function handleTimerFinish(webview) {
    if (isPomodoro) {
        const endTime = new Date().toISOString();
        let duration;

        if (pomodoroState === 'work') {
            duration = 25;
            db.run('INSERT INTO pomodoro_sessions (start_time, end_time, duration, type) VALUES (?, ?, ?, ?)', [webview.startTime, endTime, duration, 'work'], (err) => {
                if (err) {
                    console.error('Error inserting session:', err.message);
                }
            });

            pomodoroCycle = (pomodoroCycle + 1) % 4;
            const message = pomodoroCycle === 0 ? 'Great work! Take a long break!' : 'Work period finished! Time for a short break!';
            vscode.window.showInformationMessage(message);
            pomodoroState = 'break';

            if (currentTaskId) {
                db.run('UPDATE tasks SET pomodoros = pomodoros - 1 WHERE id = ?', [currentTaskId], (err) => {
                    if (err) {
                        console.error('Error updating task:', err.message);
                    } else {
                        updateTasks();
                    }
                });
            }
        } else {
            duration = 5;
            db.run('INSERT INTO pomodoro_sessions (start_time, end_time, duration, type) VALUES (?, ?, ?, ?)', [webview.startTime, endTime, duration, 'break'], (err) => {
                if (err) {
                    console.error('Error inserting session:', err.message);
                }
            });

            vscode.window.showInformationMessage('Break finished! Time to get back to work!');
            pomodoroState = 'work';
        }
        webview.startTime = new Date().toISOString();
        setPomodoroTime(webview);
    } else {
        isFinished = true;
        vscode.window.showInformationMessage('Time for a break! Move a bit!');
        clearInterval(reminderInterval);
    }
    saveState();
}

function startPomodoro(taskId, webview) {
    if (!taskId) {
        vscode.window.showErrorMessage('Please select a task to start the Pomodoro timer.');
        return;
    }
    currentTaskId = taskId;
    isPomodoro = true;
    pomodoroCycle = 0;
    pomodoroState = 'work';
    webview.startTime = new Date().toISOString();
    setPomodoroTime(webview);
}

function setPomodoroTime(webview) {
    const workTime = 1;
    const breakTime = 1;

    const time = pomodoroState === 'work' ? workTime : breakTime;
    resetTimer(time, webview);
}

function resetTimer(time, webview) {
    timeRemaining = parseInt(time) * 60;
    isPaused = false;
    isFinished = false;
    setReminder(time, webview);
}

function pauseReminder() {
    isPaused = true;
    wasPaused = true;
    vscode.window.showInformationMessage('Timer paused!');
    saveState();
}

function stopReminder() {
    if (reminderInterval) {
        clearInterval(reminderInterval);
        reminderInterval = null;
        timeRemaining = null;
        resetStates();
        vscode.window.showInformationMessage('The previous timer was stopped. You can now choose to restart any of the two timers.');
    }
    saveState();
}

function resetStates() {
    isPaused = false;
    isFinished = false;
    isPomodoro = false;
    pomodoroState = 'work';
    pomodoroCycle = 0;
    wasPaused = false;
    isRunning = false;
    currentTaskId = null;
}

function endPomodoro() {
    const endTime = new Date().toISOString();
    db.run('UPDATE pomodoro_sessions SET end_time = ? WHERE end_time = ""', [endTime], (err) => {
        if (err) {
            console.error('Error updating session:', err.message);
        }
    });
    resetStates();
    clearInterval(reminderInterval);
    reminderInterval = null;
    timeRemaining = null;
    vscode.window.showInformationMessage('Pomodoro session ended.');
    saveState();
}

function sendSessionTimesToWebview(webview) {
    getDailySessionTimes((err, rows) => {
        if (err) {
            vscode.window.showErrorMessage('Failed to fetch session times.');
            return;
        }
        webview.postMessage({
            command: 'loadSessionTimes',
            data: rows
        });
    });
}

function sendAverageSessionTimesToWebview(webview) {
    getAverageSessionTimes((err, row) => {
        if (err) {
            vscode.window.showErrorMessage('Failed to fetch average session times.');
            return;
        }
        webview.postMessage({
            command: 'loadAverageSessionTimes',
            data: row
        });
    });
}

function sendSessionCountsToWebview(webview) {
    getSessionCountsPerDay((err, rows) => {
        if (err) {
            vscode.window.showErrorMessage('Failed to fetch session counts.');
            return;
        }
        webview.postMessage({
            command: 'loadSessionCounts',
            data: rows
        });
    });
}

// Funcție pentru calcularea și afișarea rating-ului
function calculateAndShowRating() {
    calculateWeeklyRating((err, result) => {
        if (err) {
            vscode.window.showErrorMessage('Failed to calculate rating.');
            return;
        }

        console.log('Rating result:', result);

        if (dashboardPanel) {
            dashboardPanel.webview.postMessage({ 
                command: 'showRating', 
                rating: result.rating + ' / 10', 
                explanation: result.explanation,
                suggestions: result.suggestions
            });
        }
    });
}

module.exports = {
    activate
};
