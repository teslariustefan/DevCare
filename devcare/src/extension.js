const vscode = require('vscode');
const axios = require('axios');
const { authenticateWithGitHub } = require('./auth/github');
const { getWebviewContent } = require('./webviewContent');
const db = require('./database'); // Importăm baza de date

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
let extensionContext; // Variabilă globală pentru context

function activate(context) {
    extensionContext = context;
    initializeStatusBarItem(context);
    registerCommands(context);

    restoreState(); // Restaurează starea

    // Asigură-te că timer-ul continuă să ruleze în fundal
    if (isRunning) {
        setReminder(timeRemaining / 60, null);
    }
}

function initializeStatusBarItem(context) {
    myStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    myStatusBarItem.command = 'devcare.showDashboard';
    myStatusBarItem.text = "$(watch) Activate DevCare Dashboard";
    myStatusBarItem.show();
    context.subscriptions.push(myStatusBarItem);
}

function registerCommands(context) {
    context.subscriptions.push(
        vscode.commands.registerCommand('devcare.showDashboard', showDashboard),
        vscode.commands.registerCommand('devcare.authenticateWithGitHub', authenticateWithGitHub),
        vscode.commands.registerCommand('devcare.fetchGitHubData', fetchGitHubData),
        vscode.commands.registerCommand('devcare.startPomodoro', startPomodoro),
        vscode.commands.registerCommand('devcare.endPomodoro', endPomodoro)
    );
}

function showDashboard() {
    if (dashboardPanel) {
        dashboardPanel.reveal(vscode.ViewColumn.One);
    } else {
        dashboardPanel = vscode.window.createWebviewPanel(
            'DevcareDashboard',
            'DevCare Dashboard',
            vscode.ViewColumn.One,
            { enableScripts: true }
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
        dashboardPanel.webview.html = getWebviewContent(githubUser);

        // Trimite starea curentă către dashboard
        sendCurrentStateToWebview(dashboardPanel.webview);
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
                    startPomodoro(webview);
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
                await authenticateWithGitHub();
                const userData = await fetchGitHubUserName();
                if (userData) {
                    updateUserName(webview, userData);
                    updateUserInfo(webview, userData);
                } else {
                    vscode.window.showErrorMessage('Failed to fetch user name.');
                }
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
        githubUser: token ? githubUser : null
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
        private_repos: userData.private_repos,
        total_stars: userData.total_stars,
        followers: userData.followers,
        following: userData.following,
        recentCommits: userData.recentCommits,
        recentIssues: userData.recentIssues,
        recentPRs: userData.recentPRs
    });
}

async function fetchGitHubUserName() {
    const token = vscode.workspace.getConfiguration().get('devcare.githubAccessToken');
    if (!token) {
        vscode.window.showErrorMessage('Not authenticated. Please authenticate with GitHub first.');
        return null;
    }

    try {
        const response = await axios.get('https://api.github.com/user', {
            headers: { Authorization: `token ${token}` }
        });
        return {
            login: response.data.login,
            avatar_url: response.data.avatar_url,
            public_repos: response.data.public_repos,
            private_repos: response.data.total_private_repos,
            total_stars: response.data.total_stars,
            followers: response.data.followers,
            following: response.data.following
        };
    } catch (error) {
        vscode.window.showErrorMessage('Failed to fetch user name from GitHub');
        console.error(error);
        return null;
    }
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
        isRunning
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

        if (isRunning) {
            // Restaurează timer-ul
            setReminder(timeRemaining / 60, null);
        }
    }
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
            // Durata sesiunii de lucru (în minute)
            duration = 25; // 25 minutes
            // Salvăm sesiunea de lucru în baza de date
            db.run('INSERT INTO pomodoro_sessions (start_time, end_time, duration, type) VALUES (?, ?, ?, ?)', [webview.startTime, endTime, duration, 'work'], (err) => {
                if (err) {
                    console.error('Error inserting session:', err.message);
                }
            });

            pomodoroCycle = (pomodoroCycle + 1) % 4;
            const message = pomodoroCycle === 0 ? 'Great work! Take a long break!' : 'Work period finished! Time for a short break!';
            vscode.window.showInformationMessage(message);
            pomodoroState = 'break';
        } else {
            // Durata sesiunii de pauză (în minute)
            duration = 5; // 5 minutes
            // Salvăm sesiunea de pauză în baza de date
            db.run('INSERT INTO pomodoro_sessions (start_time, end_time, duration, type) VALUES (?, ?, ?, ?)', [webview.startTime, endTime, duration, 'break'], (err) => {
                if (err) {
                    console.error('Error inserting session:', err.message);
                }
            });

            vscode.window.showInformationMessage('Break finished! Time to get back to work!');
            pomodoroState = 'work';
        }
        webview.startTime = new Date().toISOString(); // Setează noul start time
        setPomodoroTime(webview);
    } else {
        isFinished = true;
        vscode.window.showInformationMessage('Time for a break! Move a bit!');
        clearInterval(reminderInterval);
    }
    saveState();
}

function startPomodoro(webview) {
    isPomodoro = true;
    pomodoroCycle = 0;
    pomodoroState = 'work';
    webview.startTime = new Date().toISOString(); // Setează start time pentru sesiunea curentă
    setPomodoroTime(webview);
}

function setPomodoroTime(webview) {
    // Durata originală a sesiunii de lucru și pauză (în minute)
    // const workTime = 25; // 25 minute
    // const breakTime = 5; // 5 minute

    // Durata modificată pentru demonstrație (în secunde)
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

module.exports = {
    activate
};
