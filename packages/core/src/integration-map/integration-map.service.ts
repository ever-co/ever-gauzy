import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
	IIntegrationMap,
	IIntegrationMapSyncRepository,
	IIntegrationSyncedRepositoryFindInput,
	IntegrationEntity
} from '@gauzy/contracts';
import { TenantAwareCrudService } from 'core/crud';
import { RequestContext } from 'core/context';
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
			throw new HttpException(`Failed to sync GitHub repository: ${error.message}`, HttpStatus.BAD_REQUEST);
		}
	}

	/**
	 * Get a synced GitHub repository based on input options.
	 *
	 * @param options - Input parameters for the query
	 * @returns A Promise of type IIntegrationMap or false if not found
	 */
	async getSyncedGithubRepository(options: IIntegrationSyncedRepositoryFindInput): Promise<IIntegrationMap | boolean> {
		try {
			const { organizationId, integrationId, gauzyId } = options;
			const tenantId = RequestContext.currentTenantId() || options.tenantId;

			const integrationMap = await this.findOneByOptions({
				where: {
					integrationId,
					gauzyId,
					organizationId,
					tenantId,
					entity: IntegrationEntity.PROJECT
				}
			});

			return integrationMap || false;
		} catch (error) {
			// Handle errors and return an appropriate error response
			return false;
		}
	}

	/**
	 * Retrieves a synchronized project from the integration map based on the provided options.
	 *
	 * @param options - An object containing organizationId, sourceId, integrationId, and tenantId.
	 * @returns The integration map for the synchronized project, or `false` if not found.
	 */
	async getSyncedProjectByRepository(options: IIntegrationSyncedRepositoryFindInput): Promise<IIntegrationMap | false> {
		try {
			const { organizationId, sourceId, integrationId, tenantId } = options;

			// Attempt to find the integration map based on the provided criteria
			const integrationMap = await this.findOneByOptions({
				where: {
					entity: IntegrationEntity.PROJECT,
					sourceId,
					integrationId,
					organizationId,
					tenantId,
				},
			});

			return integrationMap || false;
		} catch (error) {
			// Handle errors and return `false` as a default response
			return false;
		}
	}
}
