import { Injectable } from '@nestjs/common';
import { App } from 'octokit';

@Injectable()
export class OctokitService {
	constructor() {}

	async createIssue(title: string, body: string) {
		// TODO:
		// Dynamic ENV variable
		const app = new App({
			appId: '<GITHUB_INTEGRATION_APP_ID>',
			privateKey: '<GITHUB_INTEGRATION_PRIVATE_KEY>',
		});
		// TODO:
		// Need to store user's installationId in DB and make param dynamic
		const octokit = await app.getInstallationOctokit(123456);

		octokit
			.request('POST /repos/{owner}/{repo}/issues', {
				// TODO:
				// pass dynamic values as required
				// Add all the fields that we have

				owner: 'badal-ever',
				repo: 'testing-gauzy-teams-integration',

				title,
				body,
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
	async updateIssue(id: number, title: string, body: string) {
		// TODO:
		// Dynamic ENV variable
		const app = new App({
			appId: '<GITHUB_INTEGRATION_APP_ID>',
			privateKey: '<GITHUB_INTEGRATION_PRIVATE_KEY>',
		});
		// TODO:
		// Need to store user's installationId in DB and make param dynamic
		const octokit = await app.getInstallationOctokit(123456);

		octokit
			.request('PATCH /repos/{owner}/{repo}/issues/{issue_number}', {
				// TODO: pass dynamic values as required
				owner: 'badal-ever',
				repo: 'testing-gauzy-teams-integration',

				issue_number: id,
				title,
				body,
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
