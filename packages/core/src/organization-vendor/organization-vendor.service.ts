import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In } from 'typeorm';
import { OrganizationVendor } from './organization-vendor.entity';
import { Expense } from '../expense/expense.entity';
import { TenantAwareCrudService } from './../core/crud';
import { TypeOrmOrganizationVendorRepository } from './repository/type-orm-organization-vendor.repository';
import { MikroOrmOrganizationVendorRepository } from './repository/mikro-orm-organization-vendor.repository';

@Injectable()
export class OrganizationVendorService extends TenantAwareCrudService<OrganizationVendor> {
	constructor(
		@InjectRepository(OrganizationVendor)
		typeOrmOrganizationVendorRepository: TypeOrmOrganizationVendorRepository,

		mikroOrmOrganizationVendorRepository: MikroOrmOrganizationVendorRepository
	) {
		super(typeOrmOrganizationVendorRepository, mikroOrmOrganizationVendorRepository);
	}

	async deleteVendor(vendorId) {
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
