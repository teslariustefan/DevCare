function getWebviewContent(userInfo) {
    console.log('User Info:', userInfo);  // Adăugăm un log pentru a verifica userInfo

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
            h1 {
                font-size: 2.5rem;
                margin-bottom: 20px;
            }
            #authContainer {
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                border: 1px solid #fff;
                padding: 15px;
                margin-bottom: 20px;
                border-radius: 5px;
                width: 100%;
                max-width: 500px;
                text-align: center;
                gap: 10px;
            }
            #authMessage {
                margin: 0;
                font-size: 1rem;
                color: #f0f0f0;
            }
            #authAvatar {
                width: 60px;
                height: 60px;
                border-radius: 50%;
                margin: 10px 0;
                border: 2px solid #007acc;
            }
            #authButton {
                padding: 10px 20px;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 10px;
                min-width: 200px;
                max-width: 250px;
            }
            #buttonContainer {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 10px;
                margin-top: 20px;
                width: 100%;
                max-width: 600px;
            }
            button {
                background-color: #007acc;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 5px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 10px;
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
            #timeInput {
                padding: 10px;
                margin-bottom: 20px;
                width: 100px;
                text-align: center;
                border-radius: 5px;
                border: 1px solid #fff;
                background-color: #2e2e2e;
                color: white;
                font-size: 1rem;
                transition: border-color 0.3s;
            }
            #timeInput:focus {
                border-color: #007acc;
                outline: none;
            }
            #timeRemaining {
                margin-top: 20px;
                font-size: 1.2rem;
                color: #ffcc00;
                animation: countdown 60s linear infinite;
            }
            @keyframes countdown {
                0% { color: #ffcc00; }
                100% { color: #ff3333; }
            }
            hr {
                border: 0;
                border-top: 1px solid #444;
                margin: 20px 0;
                width: 100%;
            }
            #switchTimerButton {
                grid-column: span 4;
            }
        </style>
    </head>
    <body>
        <h1>Welcome to DevCare Dashboard!</h1>
        <div id="authContainer">
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
        <div id="buttonContainer">
            <button id="reminderButton" title="Set a reminder for taking a break">
                <span>🕒</span> Set reminder for break
            </button>
            <button id="pauseButton" title="Pause the current reminder">
                <span>⏸️</span> Pause
            </button>
            <button id="resumeButton" title="Resume the paused reminder">
                <span>▶️</span> Resume
            </button>
            <button id="pomodoroButton" title="Start the Pomodoro technique">
                <span>🕒</span> Start Pomodoro Technique
            </button>
            <button id="switchTimerButton" title="Switch or reset the timer">
                <span>🔄</span> Reset/Switch timer
            </button>
        </div>
        <p id="timeRemaining"></p>

        <script>
            const vscode = acquireVsCodeApi();
            document.getElementById('reminderButton').addEventListener('click', () => vscode.postMessage({ command: 'setReminder', time: document.getElementById('timeInput').value }));
            document.getElementById('pomodoroButton').addEventListener('click', () => vscode.postMessage({ command: 'startPomodoro' }));
            document.getElementById('pauseButton').addEventListener('click', () => vscode.postMessage({ command: 'pauseReminder' }));
            document.getElementById('resumeButton').addEventListener('click', () => vscode.postMessage({ command: 'startReminder' }));
            document.getElementById('switchTimerButton').addEventListener('click', () => vscode.postMessage({ command: 'stopReminder' }));
            document.getElementById('authButton').addEventListener('click', () => vscode.postMessage({ command: 'authenticateWithGitHub' }));

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
                            <small>\${issue.date}</small>
                        </li>
                    \`).join('');
                    document.getElementById('prList').innerHTML = message.recentPRs.map(pr => \`
                        <li>
                            <strong>\${pr.repository}</strong>: \${pr.title} <br>
                            <small>\${pr.date}</small>
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
                                <strong>\${commit.repository}</strong>: \${commit.message} <br>
                                <small>\${commit.date}</small>
                            </li>
                        \`).join('');
                        document.getElementById('issueList').innerHTML = state.githubUser.recentIssues.map(issue => \`
                            <li>
                                <strong>\${issue.repository}</strong>: \${issue.title} <br>
                                <small>\${issue.date}</small>
                            </li>
                        \`).join('');
                        document.getElementById('prList').innerHTML = state.githubUser.recentPRs.map(pr => \`
                            <li>
                                <strong>\${pr.repository}</strong>: \${pr.title} <br>
                                <small>\${pr.date}</small>
                            </li>
                        \`).join('');
                    }
                    const timeRemaining = document.getElementById('timeRemaining');
                    const minutes = Math.floor(state.timeRemaining / 60);
                    const seconds = state.timeRemaining % 60;
                    timeRemaining.textContent = \`Time remaining: \${minutes} minutes and \${seconds} seconds\`;
                }
            });
        </script>
    </body>
    </html>`;
}

module.exports = {
    getWebviewContent
};
