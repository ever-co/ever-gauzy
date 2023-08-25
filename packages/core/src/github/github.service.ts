import { Injectable } from '@nestjs/common';
import { Context } from 'probot';
import { GitHubService as GitHubIntegrationService } from '@gauzy/integration-github';

@Injectable()
export class GitHubService {
	constructor(
		private readonly gitHubIntegrationService: GitHubIntegrationService
	) {}

	/**
	 * ----- From GitHub to APIs -----
	 */

	async issuesOpened(context: Context) {
		console.log('Issue Created: ', context.payload);
		// TODO
		// Handle event processing
		// Find all the Projects connected to current repo and create new Task
	}
	async issuesEdited(context: Context) {
		console.log('Issue Edited', context.payload);
		// TODO
		// Handle event processing
		// Find all the Projects connected to current repo and edit task
		// To edit task we need to save issue_number of GitHub in task table
	}
	// TODO
	// Handle all other required events

	/**
	 * ----- From APIs to GitHub -----
	 */
	async openIssue(
		title: string,
		body: string,
		owner: string,
		repo: string,
		installationId: number
	) {
		await this.gitHubIntegrationService.openIssue(
			title,
			body,
			owner,
			repo,
			installationId
		);
	}
	async editIssue(
		issueNumber: number,
		title: string,
		body: string,
		owner: string,
		repo: string,
		installationId: number
	) {
		await this.gitHubIntegrationService.editIssue(
			issueNumber,
			title,
			body,
			repo,
			owner,
			installationId
		);
	}
	// TODO
	// Handle all other required events
}
