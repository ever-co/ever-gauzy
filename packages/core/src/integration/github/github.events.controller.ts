import { Controller } from '@nestjs/common';
import { Context } from 'probot';
import { Public } from '@gauzy/common';
import { Hook } from '@gauzy/integration-github';
import { GithubService } from './github.service';

@Public()
@Controller('webhook')
export class GitHubEventsController {
    constructor(
        private readonly _githubService: GithubService
    ) { }

    /**
     *
     * @param context
     */
    @Hook(['issues.opened'])
    async issuesOpened(context: Context) {
        await this._githubService.issuesOpened(context);
    }

    /**
     *
     * @param context
     */
    @Hook(['issues.edited'])
    async issuesEdited(context: Context) {
        await this._githubService.issuesEdited(context);
    }
}
