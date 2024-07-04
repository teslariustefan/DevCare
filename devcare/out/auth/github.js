"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchGitHubUserData = exports.authenticateWithGitHub = void 0;
const vscode = __importStar(require("vscode"));
const axios_1 = __importDefault(require("axios"));
const express_1 = __importDefault(require("express"));
const CLIENT_ID = 'Ov23liXu10LVVlnv7MAw';
const CLIENT_SECRET = '1e00adf51e3ed046cd6632e0114ac7578e1bb642';
const REDIRECT_URI = 'http://localhost:3000/callback';
function authenticateWithGitHub() {
    return __awaiter(this, void 0, void 0, function* () {
        const oldToken = vscode.workspace.getConfiguration().get('devcare.githubAccessToken');
        if (oldToken) {
            yield vscode.workspace.getConfiguration().update('devcare.githubAccessToken', undefined, vscode.ConfigurationTarget.Global);
            yield vscode.workspace.getConfiguration().update('devcare.githubUser', undefined, vscode.ConfigurationTarget.Global);
        }
        const app = (0, express_1.default)();
        const server = app.listen(3000, () => {
            vscode.window.showInformationMessage('Server started on http://localhost:3000');
        });
        app.get('/callback', (req, res) => __awaiter(this, void 0, void 0, function* () {
            const code = req.query.code;
            if (!code) {
                res.send('Error: no code provided');
                return;
            }
            try {
                console.log('Received code:', code);
                const tokenResponse = yield axios_1.default.post('https://github.com/login/oauth/access_token', {
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
                yield vscode.workspace.getConfiguration().update('devcare.githubAccessToken', accessToken, vscode.ConfigurationTarget.Global);
                const userData = yield fetchGitHubUserData(accessToken);
                console.log('User data:', userData);
                if (!userData) {
                    res.send('Error: failed to fetch user data');
                    return;
                }
                yield vscode.workspace.getConfiguration().update('devcare.githubUser', userData, vscode.ConfigurationTarget.Global);
                vscode.window.showInformationMessage('Successfully authenticated with GitHub!');
                res.send('Authentication successful! You can close this window.');
            }
            catch (err) {
                console.error('Error retrieving access token:', {
                    message: err.message,
                    response: err.response ? {
                        status: err.response.status,
                        data: err.response.data
                    } : null
                });
                res.send('Error retrieving access token');
            }
            finally {
                setTimeout(() => server.close(), 5000); // Închide serverul după 5 secunde pentru a asigura completarea cererilor
            }
        }));
        const authUrl = `https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&scope=repo`;
        vscode.env.openExternal(vscode.Uri.parse(authUrl));
    });
}
exports.authenticateWithGitHub = authenticateWithGitHub;
function fetchGitHubUserData(token) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const userResponse = yield axios_1.default.get('https://api.github.com/user', {
                headers: { Authorization: `token ${token}` }
            });
            const reposResponse = yield axios_1.default.get('https://api.github.com/user/repos', {
                headers: { Authorization: `token ${token}` }
            });
            const eventsResponse = yield axios_1.default.get('https://api.github.com/users/' + userResponse.data.login + '/events', {
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
        }
        catch (err) {
            vscode.window.showErrorMessage('Failed to fetch GitHub user data.');
            console.error(err);
            throw err;
        }
    });
}
exports.fetchGitHubUserData = fetchGitHubUserData;
