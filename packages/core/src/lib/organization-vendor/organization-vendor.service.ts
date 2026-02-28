import { Injectable, BadRequestException } from '@nestjs/common';
import { In } from 'typeorm';
import { BaseEntityEnum } from '@gauzy/contracts';
import { OrganizationVendor } from './organization-vendor.entity';
import { Expense } from '../expense/expense.entity';
import { TenantAwareCrudService } from './../core/crud';
import { MultiORMEnum } from './../core/utils';
import { TypeOrmOrganizationVendorRepository } from './repository/type-orm-organization-vendor.repository';
import { MikroOrmOrganizationVendorRepository } from './repository/mikro-orm-organization-vendor.repository';
import { FavoriteService } from '../core/decorators';

@FavoriteService(BaseEntityEnum.OrganizationVendor)
@Injectable()
export class OrganizationVendorService extends TenantAwareCrudService<OrganizationVendor> {
	constructor(
		typeOrmOrganizationVendorRepository: TypeOrmOrganizationVendorRepository,
		mikroOrmOrganizationVendorRepository: MikroOrmOrganizationVendorRepository
	) {
		super(typeOrmOrganizationVendorRepository, mikroOrmOrganizationVendorRepository);
	}

	async deleteVendor(vendorId) {
		switch (this.ormType) {
			case MultiORMEnum.MikroORM: {
				// Check if vendor is used in any expense records via the expenses relation
				const vendor = await this.mikroOrmRepository.findOne({ id: vendorId } as any, {
					populate: ['expenses'] as any[]
				});
				if (vendor && (vendor as any).expenses?.length > 0) {
					throw new BadRequestException("This Vendor can't be deleted because it is used in expense records");
				}
				return await this.delete(vendorId);
			}
			case MultiORMEnum.TypeORM:
			default: {
				const vendor = await this.typeOrmRepository
					.createQueryBuilder('vendor')
					.leftJoin(Expense, 'expense', 'vendor.id = expense."vendorId"')
					.where('expense."vendorId" = :vendorId', { vendorId: vendorId })
					.getOne();

				if (vendor) {
					throw new BadRequestException("This Vendor can't be deleted because it is used in expense records");
				}

				return await this.delete(vendorId);
			}
		}
	}

	public pagination(filter?: any) {
		if ('where' in filter) {
			const { where } = filter;
			if (where.tags) {
				filter.where.tags = {
					id: In(where.tags)
				};
			}
		}
		return super.paginate(filter);
	}
}
