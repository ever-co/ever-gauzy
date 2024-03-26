import { forwardRef, Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IFeatureOrganization } from '@gauzy/contracts';
import { FeatureOrganizationService } from './../../../feature/feature-organization.service';
import { TenantFeatureOrganizationCreateCommand } from '../tenant-feature-organization.create.command';

@CommandHandler(TenantFeatureOrganizationCreateCommand)
export class TenantFeatureOrganizationCreateHandler implements ICommandHandler<TenantFeatureOrganizationCreateCommand> {

	constructor(
		@Inject(forwardRef(() => FeatureOrganizationService))
		private readonly _featureOrganizationService: FeatureOrganizationService
	) { }

	/**
	 * Executes the TenantFeatureOrganizationCreateCommand. This method takes the command,
	 * extracts the necessary input data, and passes it to the _featureOrganizationService
	 * for processing. The service is responsible for creating or updating feature organizations
	 * for tenants based on the provided input.
	 *
	 * @param command An instance of TenantFeatureOrganizationCreateCommand containing tenant and feature organization data.
	 * @returns A Promise that resolves to an array of IFeatureOrganization, representing the updated or created feature organizations.
	 */
	public async execute(
		command: TenantFeatureOrganizationCreateCommand
	): Promise<IFeatureOrganization[]> {
		const { input } = command;
		return await this._featureOrganizationService.updateTenantFeatureOrganizations(input);
	}
}
