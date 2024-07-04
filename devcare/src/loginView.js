function getLoginViewContent() {
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>DevCare Login</title>
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
            .container {
                width: 100%;
                max-width: 400px;
                padding: 20px;
                border: 1px solid #fff;
                border-radius: 5px;
                background-color: #2e2e2e;
                display: flex;
                flex-direction: column;
                align-items: center;
            }
            button {
                background-color: #007acc;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 5px;
                cursor: pointer;
                transition: background-color 0.3s, transform 0.2s, box-shadow 0.3s;
                margin: 5px;
                width: calc(100% - 10px);
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
        </style>
    </head>
    <body>
        <h1>Welcome to DevCare</h1>
        <div class="container">
            <button id="authButton">Authenticate with GitHub</button>
            <button id="guestButton">Continue as Guest</button>
        </div>
        <script>
            const vscode = acquireVsCodeApi();
            document.getElementById('authButton').addEventListener('click', () => vscode.postMessage({ command: 'authenticateWithGitHub' }));
            document.getElementById('guestButton').addEventListener('click', () => vscode.postMessage({ command: 'continueAsGuest' }));
        </script>
    </body>
    </html>`;
}

module.exports = {
    getLoginViewContent
};
