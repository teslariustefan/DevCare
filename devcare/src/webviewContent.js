function getWebviewContent(userInfo) {
    const commitList = userInfo.recentCommits ? userInfo.recentCommits.map(commit => `
        <li>
            <strong>${commit.repository}</strong>: ${commit.message} <br>
            <small>${commit.date}</small>
        </li>
    `).join('') : '<li>No recent commits</li>';

    const issueList = userInfo.recentIssues ? userInfo.recentIssues.map(issue => `
        <li>
            <strong>${issue.repository}</strong>: ${issue.title} <br>
            <small>${issue.date}</small>
        </li>
    `).join('') : '<li>No recent issues</li>';

    const prList = userInfo.recentPRs ? userInfo.recentPRs.map(pr => `
        <li>
            <strong>${pr.repository}</strong>: ${pr.title} <br>
            <small>${pr.date}</small>
        </li>
    `).join('') : '<li>No recent pull requests</li>';

    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>DevCare Dashboard</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                background-color: #1e1e1e;
                color: white;
                padding: 20px;
                margin: 0;
                display: flex;
                flex-direction: column;
                align-items: center;
            }
            h1, h2, h3 {
                margin: 20px 0;
            }
            .container {
                width: 100%;
                max-width: 600px;
                margin-bottom: 20px;
                padding: 15px;
                border: 1px solid #fff;
                border-radius: 5px;
                background-color: #2e2e2e;
            }
            button {
                background-color: #007acc;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 5px;
                cursor: pointer;
                transition: background-color 0.3s, transform 0.2s, box-shadow 0.3s;
            }
            button:hover {
                background-color: #005f9e;
                transform: scale(1.05);
                box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
            }
            button:active {
                transform: scale(0.95);
                box-shadow: none;
            }
            button:disabled {
                background-color: #666;
                cursor: not-allowed;
            }
            input, select {
                padding: 10px;
                margin: 10px 0;
                width: calc(100% - 22px);
                text-align: center;
                border-radius: 5px;
                border: 1px solid #fff;
                background-color: #2e2e2e;
                color: white;
                font-size: 1rem;
            }
            input:focus, select:focus {
                border-color: #007acc;
                outline: none;
            }
            table {
                width: 100%;
                border-collapse: collapse;
                margin-top: 10px;
            }
            th, td {
                border: 1px solid #fff;
                padding: 10px;
                text-align: left;
            }
            .pomodoro-icon {
                color: tomato;
                font-size: 1.5rem;
            }
            #timeRemaining {
                font-size: 1.2rem;
                color: #ffcc00;
            }
            @keyframes countdown {
                0% { color: #ffcc00; }
                100% { color: #ff3333; }
            }
        </style>
    </head>
    <body>
        <h1>Welcome to DevCare Dashboard!</h1>
        <div id="authContainer" class="container">
            <p id="authMessage">Authenticated User: <span id="userName">Guest</span></p>
            <img id="authAvatar" src="" alt="User Avatar" style="display:none;"/>
            <p>Public Repositories: <span id="publicRepos">N/A</span></p>
            <p>Private Repositories: <span id="privateRepos">N/A</span></p>
            <p>Total Stars: <span id="totalStars">N/A</span></p>
            <p>Followers: <span id="followers">N/A</span></p>
            <p>Following: <span id="following">N/A</span></p>
            <button id="authButton" title="Click to authenticate with GitHub">
                <span>🔒</span> Authenticate with GitHub
            </button>
        </div>
        <div class="container">
            <h2>Tasks</h2>
            <form id="taskForm">
                <input type="text" id="taskName" placeholder="Task Name" required>
                <input type="number" id="taskPomodoros" placeholder="Pomodoros" required min="1">
                <button type="submit">Add Task</button>
            </form>
            <table>
                <thead>
                    <tr>
                        <th>Tasks</th>
                        <th>Number of Pomodoros</th>
                    </tr>
                </thead>
                <tbody id="taskList">
                    <!-- Task entries will be injected here -->
                </tbody>
            </table>
        </div>
        <div>
            <h2>Recent Activity</h2>
            <h3>Recent Commits</h3>
            <ul id="commitList">${commitList}</ul>
            <h3>Recent Issues</h3>
            <ul id="issueList">${issueList}</ul>
            <h3>Recent Pull Requests</h3>
            <ul id="prList">${prList}</ul>
        </div>
        <input id="timeInput" type="number" min="1" value="60" />
        <div id="buttonContainer" class="container">
            <button id="reminderButton" title="Set a reminder for taking a break">
                <span>🕒</span> Set reminder for break
            </button>
            <button id="pauseButton" title="Pause the current reminder">
                <span>⏸️</span> Pause
            </button>
            <button id="resumeButton" title="Resume the paused reminder">
                <span>▶️</span> Resume
            </button>
            <select id="taskSelector">
                <!-- Task options will be injected here -->
            </select>
            <button id="pomodoroButton" title="Start the Pomodoro technique">
                <span>🕒</span> Start Pomodoro Technique
            </button>
            <button id="switchTimerButton" title="Switch or reset the timer">
                <span>🔄</span> Reset/Switch timer
            </button>
            <select id="automatedTimerLevel">
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
            </select>
            <button id="automatedTimerButton" title="Start Automated Timer">
                <span>🕒</span> Start Automated Timer
            </button>
        </div>
        <p id="timeRemaining"></p>

        <script>
            const vscode = acquireVsCodeApi();
            document.getElementById('reminderButton').addEventListener('click', () => vscode.postMessage({ command: 'setReminder', time: document.getElementById('timeInput').value }));
            document.getElementById('pomodoroButton').addEventListener('click', () => {
                const selectedTask = document.getElementById('taskSelector').value;
                vscode.postMessage({ command: 'startPomodoro', taskId: selectedTask });
            });
            document.getElementById('pauseButton').addEventListener('click', () => vscode.postMessage({ command: 'pauseReminder' }));
            document.getElementById('resumeButton').addEventListener('click', () => vscode.postMessage({ command: 'startReminder' }));
            document.getElementById('switchTimerButton').addEventListener('click', () => vscode.postMessage({ command: 'stopReminder' }));
            document.getElementById('authButton').addEventListener('click', () => vscode.postMessage({ command: 'authenticateWithGitHub' }));
            document.getElementById('taskForm').addEventListener('submit', (event) => {
                event.preventDefault();
                const taskName = document.getElementById('taskName').value;
                const taskPomodoros = document.getElementById('taskPomodoros').value;
                vscode.postMessage({ command: 'addTask', task: { name: taskName, pomodoros: taskPomodoros } });
                document.getElementById('taskName').value = '';
                document.getElementById('taskPomodoros').value = '';
            });
            document.getElementById('automatedTimerButton').addEventListener('click', () => {
                const level = document.getElementById('automatedTimerLevel').value;
                vscode.postMessage({ command: 'startAutomatedTimer', level });
            });

            window.addEventListener('message', event => {
                const message = event.data;
                if (message.command === 'updateTime') {
                    const timeRemaining = document.getElementById('timeRemaining');
                    if (message.time <= 0) {
                        timeRemaining.textContent = 'The timer has finished!';
                    } else {
                        const minutes = Math.floor(message.time / 60);
                        const seconds = message.time % 60;
                        timeRemaining.textContent = \`Time remaining: \${minutes} minutes and \${seconds} seconds\`;
                    }
                }
                if (message.command === 'updateUserName') {
                    document.getElementById('userName').textContent = message.userName;
                    const avatarUrl = message.avatarUrl;
                    if (avatarUrl) {
                        const authAvatar = document.getElementById('authAvatar');
                        authAvatar.src = avatarUrl;
                        authAvatar.style.display = 'block';
                    }
                }
                if (message.command === 'updateUserInfo') {
                    document.getElementById('publicRepos').textContent = message.public_repos;
                    document.getElementById('privateRepos').textContent = message.private_repos;
                    document.getElementById('totalStars').textContent = message.total_stars;
                    document.getElementById('followers').textContent = message.followers;
                    document.getElementById('following').textContent = message.following;
                    document.getElementById('commitList').innerHTML = message.recentCommits.map(commit => \`
                        <li>
                            <strong>\${commit.repository}</strong>: \${commit.message} <br>
                            <small>\${commit.date}</small>
                        </li>
                    \`).join('');
                    document.getElementById('issueList').innerHTML = message.recentIssues.map(issue => \`
                        <li>
                            <strong>\${issue.repository}</strong>: \${issue.title} <br>
                            <small>\${issue.date}\</small>
                        </li>
                    \`).join('');
                    document.getElementById('prList').innerHTML = message.recentPRs.map(pr => \`
                        <li>
                            <strong>\${pr.repository}\</strong>: \${pr.title} <br>
                            <small>\${pr.date}\</small>
                        </li>
                    \`).join('');
                }
                if (message.command === 'updateState') {
                    const state = message.state;
                    document.getElementById('timeInput').value = state.timeRemaining / 60;
                    if (state.githubUser) {
                        document.getElementById('userName').textContent = state.githubUser.login;
                        const authAvatar = document.getElementById('authAvatar');
                        authAvatar.src = state.githubUser.avatar_url;
                        authAvatar.style.display = 'block';
                        document.getElementById('publicRepos').textContent = state.githubUser.public_repos;
                        document.getElementById('privateRepos').textContent = state.githubUser.private_repos;
                        document.getElementById('totalStars').textContent = state.githubUser.total_stars;
                        document.getElementById('followers').textContent = state.githubUser.followers;
                        document.getElementById('following').textContent = state.githubUser.following;
                        document.getElementById('commitList').innerHTML = state.githubUser.recentCommits.map(commit => \`
                            <li>
                                <strong>\${commit.repository}\</strong>: \${commit.message} <br>
                                <small>\${commit.date}\</small>
                            </li>
                        \`).join('');
                        document.getElementById('issueList').innerHTML = state.githubUser.recentIssues.map(issue => \`
                            <li>
                                <strong>\${issue.repository}\</strong>: \${issue.title} <br>
                                <small>\${issue.date}\</small>
                            </li>
                        \`).join('');
                        document.getElementById('prList').innerHTML = state.githubUser.recentPRs.map(pr => \`
                            <li>
                                <strong>\${pr.repository}\</strong>: \${pr.title} <br>
                                <small>\${pr.date}\</small>
                            </li>
                        \`).join('');
                    }
                    const timeRemaining = document.getElementById('timeRemaining');
                    const minutes = Math.floor(state.timeRemaining / 60);
                    const seconds = state.timeRemaining % 60;
                    timeRemaining.textContent = \`Time remaining: \${minutes} minutes and \${seconds} seconds\`;
                }
                if (message.command === 'updateTasks') {
                    const taskList = document.getElementById('taskList');
                    const taskSelector = document.getElementById('taskSelector');
                    taskList.innerHTML = '';
                    taskSelector.innerHTML = '<option value="">Select a Task</option>';
                    message.tasks.forEach(task => {
                        const row = document.createElement('tr');
                        const taskNameCell = document.createElement('td');
                        const taskPomodorosCell = document.createElement('td');
                        taskNameCell.textContent = task.name;
                        taskPomodorosCell.innerHTML = '🍅'.repeat(task.pomodoros);
                        row.appendChild(taskNameCell);
                        row.appendChild(taskPomodorosCell);
                        taskList.appendChild(row);

                        const option = document.createElement('option');
                        option.value = task.id;
                        option.textContent = task.name + " (" + task.pomodoros + " 🍅)";
                        taskSelector.appendChild(option);
                    });
                }
            });
        </script>
    </body>
    </html>`;
}

module.exports = {
    getWebviewContent
};
