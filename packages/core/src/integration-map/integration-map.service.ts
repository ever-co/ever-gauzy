import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IIntegrationMap, IIntegrationMapSyncRepository } from '@gauzy/contracts';
import { TenantAwareCrudService } from './../core/crud';
import { IntegrationMap } from './integration-map.entity';
import { IntegrationMapSyncRepositoryCommand } from './commands';

@Injectable()
export class IntegrationMapService extends TenantAwareCrudService<IntegrationMap> {

	private readonly logger = new Logger('IntegrationMapService');

	constructor(
		@InjectRepository(IntegrationMap)
		private readonly integrationMap: Repository<IntegrationMap>,

		private readonly _commandBus: CommandBus
	) {
		super(integrationMap);
	}

	/**
	 * Synchronize a GitHub repository with an integration.
	 *
	 * @param input - The input data for synchronization.
	 * @returns An object indicating success or failure of the synchronization.
	 */
	async syncGithubRepository(
		input: IIntegrationMapSyncRepository
	): Promise<IIntegrationMap> {
		try {
			return await this._commandBus.execute(
				new IntegrationMapSyncRepositoryCommand(input)
			);
		} catch (error) {
			// Handle errors and return an appropriate error response
			this.logger.error('Error while sync github integration repository', error.message);
			throw new HttpException(`Failed to add GitHub App Installation: ${error.message}`, HttpStatus.BAD_REQUEST);
		}
	}
}
