import * as vscode from 'vscode';
import axios from 'axios';
import express from 'express';

const CLIENT_ID = 'YOUR_GITHUB_CLIENT_ID';
const CLIENT_SECRET = 'YOUR_GITHUB_CLIENT_SECRET';
const REDIRECT_URI = 'http://localhost:3000/callback';

export function authenticateWithGitHub() {
    const app = express();
    const server = app.listen(3000, () => {
        vscode.window.showInformationMessage('Server started on http://localhost:3000');
    });

    app.get('/callback', async (req: express.Request, res: express.Response) => {
        const code = req.query.code as string;
        if (!code) {
            res.send('Error: no code provided');
            return;
        }

        try {
            const tokenResponse = await axios.post('https://github.com/login/oauth/access_token', {
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                code,
                redirect_uri: REDIRECT_URI,
            }, {
                headers: {
                    accept: 'application/json',
                },
            });

            const accessToken = tokenResponse.data.access_token;
            vscode.window.showInformationMessage(`GitHub access token: ${accessToken}`);
            res.send('Authentication successful! You can close this window.');
        } catch (error) {
            res.send('Error retrieving access token');
            console.error(error);
        } finally {
            server.close();
        }
    });

    const authUrl = `https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&scope=repo`;
    vscode.env.openExternal(vscode.Uri.parse(authUrl));
}
