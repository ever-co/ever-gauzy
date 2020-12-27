import { IFeatureOrganization } from '@gauzy/models';
import { forwardRef, Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { FeatureService } from '../../../feature/feature.service';
import { TenantFeatureOrganizationCreateCommand } from '../tenant-feature-organization.create.command';

@CommandHandler(TenantFeatureOrganizationCreateCommand)
export class TenantFeatureOrganizationCreateHandler
	implements ICommandHandler<TenantFeatureOrganizationCreateCommand> {
	constructor(
		@Inject(forwardRef(() => FeatureService))
		private readonly _featureService: FeatureService
	) {}

	public async execute(
		command: TenantFeatureOrganizationCreateCommand
	): Promise<IFeatureOrganization[]> {
		const { input } = command;
		return await this._featureService.updateTenantFeatureOrganizations(
			input
		);
	}
}
