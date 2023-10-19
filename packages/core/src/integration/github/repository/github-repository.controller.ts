import { IIntegrationMapSyncRepository, IOrganizationGithubRepository } from '@gauzy/contracts';
import { Body, Controller, Post } from '@nestjs/common';
import { GithubRepositoryService } from './github-repository.service';

@Controller('repository')
export class GitHubRepositoryController {

    constructor(
        private readonly _githubRepositoryService: GithubRepositoryService
    ) { }

    /**
     * Sync a GitHub repository with Gauzy using provided data.
     *
     * @param entity The data needed for synchronization.
     * @returns The synchronized integration map.
     */
    @Post('/sync')
    async syncRepository(
        @Body() entity: IIntegrationMapSyncRepository,
    ): Promise<IOrganizationGithubRepository> {
        try {
            return await this._githubRepositoryService.syncGithubRepository(entity);
        } catch (error) {
            // Handle errors, e.g., return an error response.
            throw new Error('Failed to sync GitHub repository');
        }
    }
}
