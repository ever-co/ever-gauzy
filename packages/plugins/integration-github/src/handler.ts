import { createNodeMiddleware, createProbot } from 'probot';
import app from './index';

const GITHUB_INTEGRATION_APP_ID = 123456;
const GITHUB_INTEGRATION_PRIVATE_KEY = '<WIP>';
const GITHUB_INTEGRATION_APP_INSTALLATION_ID = 123456;
const GITHUB_INTEGRATION_CLIENT_ID = '<WIP>';
const GITHUB_INTEGRATION_CLIENT_SECRET = '<WIP>';
const GITHUB_INTEGRATION_WEBHOOK_SECRET = '<WIP>';

const probot = createProbot({
	defaults: {
		appId: GITHUB_INTEGRATION_APP_ID,
		privateKey: GITHUB_INTEGRATION_PRIVATE_KEY,
		secret: GITHUB_INTEGRATION_WEBHOOK_SECRET,
	},
	overrides: {
		appId: GITHUB_INTEGRATION_APP_ID,
		privateKey: GITHUB_INTEGRATION_PRIVATE_KEY,
		secret: GITHUB_INTEGRATION_WEBHOOK_SECRET,
	},
});

export default createNodeMiddleware(app, {
	probot,
	webhooksPath: '/api/github/webhooks',
});
