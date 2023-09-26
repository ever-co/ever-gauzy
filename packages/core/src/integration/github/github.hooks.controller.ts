import { Controller } from '@nestjs/common';
import { Context } from 'probot';
import { Public } from '@gauzy/common';
import { Hook } from '@gauzy/integration-github';
import { GithubHooksService } from './github.hooks.service';

@Public()
@Controller('webhook')
export class GitHubHooksController {
    constructor(
        private readonly _githubHooksService: GithubHooksService
    ) { }

    /**
     *
     * @param context
     */
    @Hook(['issues.opened'])
    async issuesOpened(context: Context) {
        await this._githubHooksService.issuesOpened(context);
    }

    /**
     *
     * @param context
     */
    @Hook(['issues.edited'])
    async issuesEdited(context: Context) {
        await this._githubHooksService.issuesEdited(context);
    }
}
