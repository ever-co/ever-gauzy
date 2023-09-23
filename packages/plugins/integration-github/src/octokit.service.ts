import { Inject, Injectable } from '@nestjs/common';
import { App } from 'octokit';
import { ModuleProviders, ProbotConfig } from './probot.types';
import { ResponseHeaders as OctokitResponseHeaders } from "@octokit/types";

const GITHUB_API_VERSION = process.env.GITHUB_API_VERSION;

export interface OctokitResponse<T> {
	data: T; // The response data received from the GitHub API.
	status: number; // The HTTP status code of the response (e.g., 200, 404, etc.).
	headers: OctokitResponseHeaders; // The headers included in the response.
	[key: string]: any; // Additional properties may be present depending on the specific response.
}

@Injectable()
export class OctokitService {
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
	 * @param installation_id The installation ID for the GitHub App.
	 * @returns GitHub metadata.
	 */
	public async getInstallationMetadata(installation_id: number): Promise<OctokitResponse<any>> {
		try {
			// Get an Octokit instance for the installation
			const octokit = await this.app.getInstallationOctokit(installation_id);

			// Send a request to the GitHub API to get metadata
			return await octokit.request('GET /app/installations/{installation_id}', {
				installation_id,
				headers: {
					'X-GitHub-Api-Version': GITHUB_API_VERSION
				}
			});
		} catch (error) {
			throw new Error('Failed to fetch GitHub metadata');
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
