import { getPrivateKey } from '@probot/get-private-key';
import { Probot } from 'probot';
import SmeeClient from 'smee-client';
import { OctokitConfig, ProbotConfig } from './probot.types';
import { Octokit } from '@octokit/rest';
import { createAppAuth } from '@octokit/auth-app';

export const parseConfig = (config: ProbotConfig): Record<string, any> => {
	return {
		appId: config.appId,
		privateKey: getPrivateKey({
			env: { PRIVATE_KEY: config.privateKey },
		}) as string,
		webhookSecret: config.webhookSecret,
		ghUrl: config.ghUrl || 'https://api.github.com',
		webhookProxy: config.webhookProxy,
		webhookPath: config.webhookPath,
		clientId: config.clientId,
		clientSecret: config.clientSecret,
	};
};

export const createProbot = (config: ProbotConfig): Probot => {
	const parsedConfig = parseConfig(config);
	return new Probot({
		appId: parsedConfig.appId,
		privateKey: parsedConfig.privateKey,
		secret: parsedConfig.webhookSecret,
		baseUrl: parsedConfig.ghUrl,
	});
};

export const createSmee = (config: ProbotConfig) => {
	const parsedConfig = parseConfig(config);
	return new SmeeClient({
		source: parsedConfig.webhookProxy as string,
		target: parsedConfig.webhookPath as string,
		logger: console,
	});
};

export const createOctokit = (config: OctokitConfig): Octokit => {
	return new Octokit({
		authStrategy: createAppAuth,
		baseUrl: config.probot.ghUrl,
		auth: {
			...config.auth,
			appId: config.probot.appId,
			privateKey: config.probot.privateKey,
			clientId: config.probot.clientId,
			clientSecret: config.probot.clientSecret,
		},
	});
};
