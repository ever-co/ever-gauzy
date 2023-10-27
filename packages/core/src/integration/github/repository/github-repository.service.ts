
import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CommandBus } from '@nestjs/cqrs';
import { Repository } from 'typeorm';
import { IIntegrationMapSyncRepository, IOrganizationGithubRepository } from '@gauzy/contracts';
import { TenantAwareCrudService } from 'core/crud';
import { OrganizationGithubRepository } from './github-repository.entity';
import { IntegrationSyncGithubRepositoryCommand } from '../commands';

@Injectable()
export class GithubRepositoryService extends TenantAwareCrudService<OrganizationGithubRepository> {
    private readonly logger = new Logger('GithubRepositoryService');

    constructor(
        private readonly _commandBus: CommandBus,

        @InjectRepository(OrganizationGithubRepository)
        private readonly organizationGithubRepository: Repository<OrganizationGithubRepository>
    ) {
        super(organizationGithubRepository);
    }

    /**
     * Synchronize a GitHub repository with an integration.
     *
     * @param input - The input data for synchronization.
     * @returns An object indicating success or failure of the synchronization.
     */
    async syncGithubRepository(
        input: IIntegrationMapSyncRepository
    ): Promise<IOrganizationGithubRepository> {
        try {
            return await this._commandBus.execute(
                new IntegrationSyncGithubRepositoryCommand(input, false)
            );
        } catch (error) {
            // Handle errors and return an appropriate error response
            this.logger.error('Error while sync github integration repository', error.message);
            throw new HttpException(`Failed to sync GitHub repository: ${error.message}`, HttpStatus.BAD_REQUEST);
        }
    }
}
