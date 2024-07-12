import { getPrivateKey } from '@probot/get-private-key';
import { Probot } from 'probot';
import SmeeClient from 'smee-client';
import { Octokit } from '@octokit/rest';
import { createAppAuth } from '@octokit/auth-app';
import * as chalk from 'chalk';
import { OctokitConfig, ProbotConfig } from './probot.types';

// GITHUB API URL
export const GITHUB_API_URL = 'https://api.github.com';

/**
 * Parse and restructure Probot configuration into a more organized format.
 * @param config - Probot configuration.
 * @returns Parsed configuration object.
 */
export const parseConfig = (config: ProbotConfig): Record<string, any> => ({
	appId: config.appId,
	privateKey: getPrivateKey({
		env: { PRIVATE_KEY: config.privateKey ? config.privateKey.replace(/\\n/g, '\n') : '' }
	}) as string,
	webhookSecret: config.webhookSecret,
	ghUrl: config.ghUrl || GITHUB_API_URL,
	webhookProxy: config.webhookProxy,
	webhookPath: config.webhookPath,
	clientId: config.clientId,
	clientSecret: config.clientSecret
});

/**
 * Create and configure a Probot instance.
 * @param config - Probot configuration.
 * @returns A configured Probot instance.
 */
export const createProbot = (config: ProbotConfig): Probot => {
	const parsedConfig = parseConfig(config);

	const logging = false;

	if (logging) {
		console.log(chalk.magenta(`Probot Configuration ${JSON.stringify(parsedConfig)}`));
	}

	return new Probot({
		...parsedConfig // Spread the parsed configuration properties
	});
};

/**
 * Create and configure a SmeeClient instance.
 * @param config - Probot configuration.
 * @returns A configured SmeeClient instance.
 */
export const createSmee = (config: ProbotConfig): SmeeClient => {
	const parsedConfig = parseConfig(config);
	return new SmeeClient({
		source: parsedConfig.webhookProxy as string,
		target: parsedConfig.webhookPath as string,
		logger: console
	});
};

/**
 * Create and configure an Octokit instance for GitHub API requests.
 * @param config - Configuration options for Octokit.
 * @returns An Octokit instance.
 */
export const createOctokit = (config: OctokitConfig): Octokit => {
	/** Parsed Probot Config */
	const probot = parseConfig(config.probot);
	/** return an Octokit instance. */
	return new Octokit({
		authStrategy: createAppAuth,
		baseUrl: probot.ghUrl,
		auth: {
			appId: probot.appId,
			privateKey: probot.privateKey,
			clientId: probot.clientId,
			clientSecret: probot.clientSecret,
			...config.auth // Include other auth options if needed
		}
	});
};
