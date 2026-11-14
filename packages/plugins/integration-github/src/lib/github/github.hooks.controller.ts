import { Controller } from '@nestjs/common';
import { Public } from '@gauzy/common';
import type { Context as ProbotContext } from 'probot';
import { Hook } from '../probot/hook.decorator';
import { GithubHooksService } from './github.hooks.service';
import {
	GithubTaskLinkService,
	IGithubIssueClosedPayload,
	IGithubPullRequestClosedPayload
} from './github-task-link.service';

@Public()
@Controller('/integration/github/webhook')
export class GitHubHooksController {
	constructor(
		private readonly _githubHooksService: GithubHooksService,
		private readonly _githubTaskLinkService: GithubTaskLinkService
	) {}

	/**
	 * Handles the 'installation.deleted' event.
	 *
	 * @param context - The context object containing information about the event.
	 */
	@Hook(['installation.deleted'])
	async installationDeleted(context: ProbotContext) {
		if (!context.isBot) {
			await this._githubHooksService.installationDeleted(context);
		}
	}

	/**
	 * Handles the 'issues.opened' event.
	 *
	 * @param context - The context object containing information about the event.
	 */
	@Hook(['issues.opened'])
	async issuesOpened(context: ProbotContext) {
		if (!context.isBot) {
			await this._githubHooksService.issuesOpened(context);
		}
	}

	/**
	 * Handles the 'issues.edited' event.
	 *
	 * @param context - The context object containing information about the event.
	 */
	@Hook(['issues.edited'])
	async issuesEdited(context: ProbotContext) {
		if (!context.isBot) {
			await this._githubHooksService.issuesEdited(context);
		}
	}

	/**
	 * Handles the 'issues.labeled' event.
	 *
	 * @param context - The context object containing information about the event.
	 */
	@Hook(['issues.labeled'])
	async issuesLabeled(context: ProbotContext) {
		if (!context.isBot) {
			await this._githubHooksService.issuesLabeled(context);
		}
	}

	/**
	 * Handles the 'issues.labeled' event.
	 *
	 * @param context - The context object containing information about the event.
	 */
	@Hook(['issues.unlabeled'])
	async issuesUnlabeled(context: ProbotContext) {
		if (!context.isBot) {
			await this._githubHooksService.issuesUnlabeled(context);
		}
	}

	/**
	 * Handles the 'pull_request.closed' event (merged or not): the tasks the pull request is linked to are reported to
	 * the task automations. A bot's close counts too (a merge queue or an auto-merge closes as a bot), and nothing here
	 * writes back to GitHub, so there is no loop to guard.
	 *
	 * @param context - The context object containing information about the event.
	 */
	@Hook(['pull_request.closed'])
	async pullRequestClosed(context: ProbotContext) {
		await this._githubTaskLinkService.pullRequestClosed(
			context.id,
			context.payload as IGithubPullRequestClosedPayload
		);
	}

	/**
	 * Handles the 'issues.closed' event: the task that mirrors the issue, and the tasks linked to it, are reported to
	 * the task automations.
	 *
	 * @param context - The context object containing information about the event.
	 */
	@Hook(['issues.closed'])
	async issuesClosed(context: ProbotContext) {
		await this._githubTaskLinkService.issueClosed(context.id, context.payload as IGithubIssueClosedPayload);
	}
}
