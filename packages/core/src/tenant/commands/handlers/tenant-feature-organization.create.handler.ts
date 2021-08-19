import { IFeatureOrganization } from '@gauzy/contracts';
import { forwardRef, Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { FeatureOrganizationService } from './../../../feature/feature-organization.service';
import { TenantFeatureOrganizationCreateCommand } from '../tenant-feature-organization.create.command';

@CommandHandler(TenantFeatureOrganizationCreateCommand)
export class TenantFeatureOrganizationCreateHandler
	implements ICommandHandler<TenantFeatureOrganizationCreateCommand> {
	constructor(
		@Inject(forwardRef(() => FeatureOrganizationService))
		private readonly _featureOrganizationService: FeatureOrganizationService
	) {}

	public async execute(
		command: TenantFeatureOrganizationCreateCommand
	): Promise<IFeatureOrganization[]> {
		const { input } = command;
		return await this._featureOrganizationService.updateTenantFeatureOrganizations(
			input
		);
	}
}
