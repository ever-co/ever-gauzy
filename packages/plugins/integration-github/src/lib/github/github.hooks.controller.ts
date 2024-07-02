import { Controller } from '@nestjs/common';
import { Context } from 'probot';
import { Public } from '@gauzy/common';
import { Hook } from '../probot/hook.decorator';
import { GithubHooksService } from './github.hooks.service';

@Public()
@Controller('webhook')
export class GitHubHooksController {
	constructor(private readonly _githubHooksService: GithubHooksService) {}

	/**
	 * Handles the 'installation.deleted' event.
	 *
	 * @param context - The context object containing information about the event.
	 */
	@Hook(['installation.deleted'])
	async installationDeleted(context: Context) {
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
	async issuesOpened(context: Context) {
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
	async issuesEdited(context: Context) {
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
	async issuesLabeled(context: Context) {
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
	async issuesUnlabeled(context: Context) {
		if (!context.isBot) {
			await this._githubHooksService.issuesUnlabeled(context);
		}
	}
}
