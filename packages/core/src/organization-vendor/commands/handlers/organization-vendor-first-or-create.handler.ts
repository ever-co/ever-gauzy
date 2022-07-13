import { NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Brackets, FindOneOptions, SelectQueryBuilder, WhereExpressionBuilder } from 'typeorm';
import { RequestContext } from './../../../core/context';
import { OrganizationVendorFirstOrCreateCommand } from './../organization-vendor-first-or-create.command';
import { OrganizationVendorService } from './../../organization-vendor.service';
import { OrganizationVendor } from './../../organization-vendor.entity';

@CommandHandler(OrganizationVendorFirstOrCreateCommand)
export class OrganizationVendorFirstOrCreateHandler
	implements ICommandHandler<OrganizationVendorFirstOrCreateCommand> {

	constructor(
		private readonly _organizationVendorService : OrganizationVendorService
	) {}

	public async execute(
		command: OrganizationVendorFirstOrCreateCommand
	) {
		const { input } = command;
		try {
			return await this._organizationVendorService.findOneByOptions({
				where: (query: SelectQueryBuilder<OrganizationVendor>) => {
					query.andWhere(
						new Brackets((qb: WhereExpressionBuilder) => {
							const { organizationId, name } = input;
							const tenantId = RequestContext.currentTenantId();

							qb.andWhere(`"${query.alias}"."tenantId" = :tenantId`, { tenantId });
							qb.andWhere(`"${query.alias}"."organizationId" = :organizationId`, { organizationId });
							qb.andWhere(`"${query.alias}"."name" = :name`, { name });
						})
					);
				}
			} as FindOneOptions<OrganizationVendor>);
		} catch (error) {
			if (error instanceof NotFoundException) {
				return await this._organizationVendorService.create(input);
			}
		}
	}
}
