import { Hook } from '@gauzy/integration-github';
import { Controller } from '@nestjs/common';
import { Context } from 'probot';
import { GitHubService } from './github.service';

@Controller()
export class GitHubController {
	constructor(private readonly gitHubService: GitHubService) {}

	@Hook(['issues.opened'])
	async issuesOpened(context: Context) {
		await this.gitHubService.issuesOpened(context);
	}

	@Hook(['issues.edited'])
	async issuesEdited(context: Context) {
		await this.gitHubService.issuesEdited(context);
	}

	// TODO
	// Handle all other required events
}
