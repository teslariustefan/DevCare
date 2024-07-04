import * as vscode from 'vscode';
import axios from 'axios';
import express from 'express';

const CLIENT_ID = 'Ov23liXu10LVVlnv7MAw';
const CLIENT_SECRET = '1e00adf51e3ed046cd6632e0114ac7578e1bb642';
const REDIRECT_URI = 'http://localhost:3000/callback';

export async function authenticateWithGitHub() {
    const oldToken = vscode.workspace.getConfiguration().get('devcare.githubAccessToken');
    if (oldToken) {
        await vscode.workspace.getConfiguration().update('devcare.githubAccessToken', undefined, vscode.ConfigurationTarget.Global);
        await vscode.workspace.getConfiguration().update('devcare.githubUser', undefined, vscode.ConfigurationTarget.Global);
    }

    const app = express();
    const server = app.listen(3000, () => {
        vscode.window.showInformationMessage('Server started on http://localhost:3000');
    });

    app.get('/callback', async (req, res) => {
        const code = req.query.code as string;
        if (!code) {
            res.send('Error: no code provided');
            return;
        }

        try {
            console.log('Received code:', code);

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

            console.log('Token response:', tokenResponse.data);

            const accessToken = tokenResponse.data.access_token;
            console.log('Access token:', accessToken);

            if (!accessToken) {
                res.send('Error: no access token received');
                return;
            }

            await vscode.workspace.getConfiguration().update('devcare.githubAccessToken', accessToken, vscode.ConfigurationTarget.Global);

            const userData = await fetchGitHubUserData(accessToken);
            console.log('User data:', userData);

            if (!userData) {
                res.send('Error: failed to fetch user data');
                return;
            }

            await vscode.workspace.getConfiguration().update('devcare.githubUser', userData, vscode.ConfigurationTarget.Global);
            vscode.window.showInformationMessage('Successfully authenticated with GitHub!');

            res.send('Authentication successful! You can close this window.');
        } catch (err: any) {
            console.error('Error retrieving access token:', {
                message: err.message,
                response: err.response ? {
                    status: err.response.status,
                    data: err.response.data
                } : null
            });
            res.send('Error retrieving access token');
        } finally {
            setTimeout(() => server.close(), 5000); // Închide serverul după 5 secunde pentru a asigura completarea cererilor
        }
    });

    const authUrl = `https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&scope=repo`;
    vscode.env.openExternal(vscode.Uri.parse(authUrl));
}

async function fetchGitHubUserData(token) {
    try {
        const userResponse = await axios.get('https://api.github.com/user', {
            headers: { Authorization: `token ${token}` }
        });

        const reposResponse = await axios.get('https://api.github.com/user/repos', {
            headers: { Authorization: `token ${token}` }
        });

        const eventsResponse = await axios.get('https://api.github.com/users/' + userResponse.data.login + '/events', {
            headers: { Authorization: `token ${token}` }
        });

        const totalStars = reposResponse.data.reduce((sum, repo) => sum + repo.stargazers_count, 0);

        const recentCommits = eventsResponse.data
            .filter(event => event.type === 'PushEvent')
            .flatMap(event => event.payload.commits.map(commit => ({
                message: commit.message,
                date: event.created_at,
                repository: event.repo.name
            })))
            .slice(0, 5);

        const recentIssues = eventsResponse.data
            .filter(event => event.type === 'IssuesEvent' || event.type === 'IssueCommentEvent')
            .map(event => ({
                title: event.payload.issue.title,
                date: event.created_at,
                repository: event.repo.name
            }))
            .slice(0, 5);

        const recentPRs = eventsResponse.data
            .filter(event => event.type === 'PullRequestEvent')
            .map(event => ({
                title: event.payload.pull_request.title,
                date: event.created_at,
                repository: event.repo.name
            }))
            .slice(0, 5);

        return {
            login: userResponse.data.login,
            avatar_url: userResponse.data.avatar_url,
            public_repos: userResponse.data.public_repos,
            private_repos: reposResponse.data.length - userResponse.data.public_repos,
            total_stars: totalStars,
            followers: userResponse.data.followers,
            following: userResponse.data.following,
            recentCommits,
            recentIssues,
            recentPRs
        };
    } catch (err) {
        vscode.window.showErrorMessage('Failed to fetch GitHub user data.');
        console.error(err);
        throw err;
    }
}

export { fetchGitHubUserData };
