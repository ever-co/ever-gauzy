import { Inject, Injectable, Logger } from '@nestjs/common';
import { App } from 'octokit';
import { ModuleProviders, ProbotConfig } from './probot.types';
import { ResponseHeaders as OctokitResponseHeaders } from "@octokit/types";

const GAUZY_GITHUB_API_VERSION = process.env.GAUZY_GITHUB_API_VERSION;

export interface OctokitResponse<T> {
	data: T; // The response data received from the GitHub API.
	status: number; // The HTTP status code of the response (e.g., 200, 404, etc.).
	headers: OctokitResponseHeaders; // The headers included in the response.
	[key: string]: any; // Additional properties may be present depending on the specific response.
}

@Injectable()
export class OctokitService {
	private readonly logger = new Logger('OctokitService');

	/** */
	private readonly app: App;

	constructor(
		@Inject(ModuleProviders.ProbotConfig)
		private readonly config: ProbotConfig
	) {
		this.app = new App({
			appId: this.config.appId,
			privateKey: this.config.privateKey,
		});
	}

	/**
	 * Get GitHub metadata for a specific installation.
	 *
	 * @param installation_id The installation ID for the GitHub App.
	 * @returns {Promise<OctokitResponse<any>>} A promise that resolves with the GitHub metadata.
	 * @throws {Error} If the request to fetch metadata fails.
	 */
	public async getGithubInstallationMetadata(installation_id: number): Promise<OctokitResponse<any>> {
		try {
			// Get an Octokit instance for the installation
			const octokit = await this.app.getInstallationOctokit(installation_id);

			// Send a request to the GitHub API to get installation metadata
			return await octokit.request('GET /app/installations/{installation_id}', {
				installation_id,
				headers: {
					'X-GitHub-Api-Version': GAUZY_GITHUB_API_VERSION
				}
			});
		} catch (error) {
			this.logger.error('Failed to fetch GitHub installation metadata', error.message);
			throw new Error('Failed to fetch GitHub installation metadata');
		}
	}

	/**
	 * Get GitHub repositories for a specific installation.
	 *
	 * @param installation_id The installation ID for the GitHub App.
	 * @returns {Promise<OctokitResponse<any>>} A promise that resolves with the GitHub repositories.
	 * @throws {Error} If the request to fetch repositories fails.
	 */
	public async getGithubRepositories(installation_id: number): Promise<OctokitResponse<any>> {
		try {
			// Get an Octokit instance for the installation
			const octokit = await this.app.getInstallationOctokit(installation_id);

			// Send a request to the GitHub API to get repositories
			return await octokit.request('GET /installation/repositories', {
				installation_id,
				headers: {
					'X-GitHub-Api-Version': GAUZY_GITHUB_API_VERSION
				}
			});
		} catch (error) {
			this.logger.error('Failed to fetch GitHub installation repositories', error.message);
			throw new Error('Failed to fetch GitHub installation repositories');
		}
	}

	/**
	 * Fetch GitHub repository issues for a given installation, owner, and repository.
	 *
	 * @param {number} installation_id - The installation ID for the GitHub app.
	 * @param {Object} options - Options object with 'owner' and 'repo' properties.
	 * @param {string} options.owner - The owner (username or organization) of the repository.
	 * @param {string} options.repo - The name of the repository.
	 * @returns {Promise<OctokitResponse<any>>} A promise that resolves to the response from the GitHub API.
	 * @throws {Error} If the request to the GitHub API fails.
	 */
	public async getGithubRepositoryIssues(installation_id: number, {
		owner,
		repo
	}: {
		owner: string;
		repo: string;
	}): Promise<OctokitResponse<any>> {
		try {
			// Get an Octokit instance for the installation
			const octokit = await this.app.getInstallationOctokit(installation_id);

			// Send a request to the GitHub API to get repository issues
			return await octokit.request('GET /repos/{owner}/{repo}/issues', {
				owner: owner,
				repo: repo,
				headers: {
					'X-GitHub-Api-Version': GAUZY_GITHUB_API_VERSION
				}
			});
		} catch (error) {
			this.logger.error('Failed to fetch GitHub installation repository issues', error.message);
			throw new Error('Failed to fetch GitHub installation repository issues');
		}
	}

	async openIssue(
		title: string,
		body: string,
		owner: string,
		repo: string,
		installationId: number
	) {
		const octokit = await this.app.getInstallationOctokit(installationId);
		octokit
			.request('POST /repos/{owner}/{repo}/issues', {
				owner,
				repo,
				title,
				body,
				headers: {
					'X-GitHub-Api-Version': '2022-11-28',
				},
			})
			.then((data) => {
				console.log('data', data);
			})
			.catch((error) => {
				console.log('error', error);
			});
	}

	async editIssue(
		issueNumber: number,
		title: string,
		body: string,
		repo: string,
		owner: string,
		installationId: number
	) {
		const octokit = await this.app.getInstallationOctokit(installationId);
		octokit
			.request('PATCH /repos/{owner}/{repo}/issues/{issue_number}', {
				owner,
				repo,
				title,
				body,

				issue_number: issueNumber,

				// TODO:
				// pass dynamic values as required
				// Add all the fields that we have
				// Ex.
				// labels: ['bug', 'GauzyAPI'],

				headers: {
					'X-GitHub-Api-Version': '2022-11-28',
				},
			})
			.then((data) => {
				console.log('data', data);
			})
			.catch((error) => {
				console.log('error', error);
			});
	}
}
