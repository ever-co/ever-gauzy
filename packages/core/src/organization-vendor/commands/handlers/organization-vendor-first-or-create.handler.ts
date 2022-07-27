import { NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IOrganizationVendor } from '@gauzy/contracts';
import { RequestContext } from './../../../core/context';
import { OrganizationVendorFirstOrCreateCommand } from './../organization-vendor-first-or-create.command';
import { OrganizationVendorService } from './../../organization-vendor.service';

@CommandHandler(OrganizationVendorFirstOrCreateCommand)
export class OrganizationVendorFirstOrCreateHandler
	implements ICommandHandler<OrganizationVendorFirstOrCreateCommand> {

	constructor(
		private readonly _organizationVendorService : OrganizationVendorService
	) {}

	public async execute(
		command: OrganizationVendorFirstOrCreateCommand
	): Promise<IOrganizationVendor> {
		const { input } = command;
		try {
			const { organizationId, name } = input;
			const tenantId = RequestContext.currentTenantId();

			return await this._organizationVendorService.findOneByWhereOptions({
				tenantId,
				organizationId,
				name
			});
		} catch (error) {
			if (error instanceof NotFoundException) {
				return await this._organizationVendorService.create(input);
			}
		}
	}
}
