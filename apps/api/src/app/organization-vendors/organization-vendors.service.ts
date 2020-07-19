import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrganizationVendor } from './organization-vendors.entity';
import { Expense } from '../expense/expense.entity';
import { TenantAwareCrudService } from '../core/crud/tenant-aware-crud.service';

@Injectable()
export class OrganizationVendorsService extends TenantAwareCrudService<
	OrganizationVendor
> {
	constructor(
		@InjectRepository(OrganizationVendor)
		private readonly organizationVendorsRepository: Repository<
			OrganizationVendor
		>
	) {
		super(organizationVendorsRepository);
	}

	async deleteVendor(vendorId) {
		const vendor = await this.organizationVendorsRepository
			.createQueryBuilder('vendor')
			.leftJoin(Expense, 'expense', 'vendor.id = expense."vendorId"')
			.where('expense."vendorId" = :vendorId', { vendorId: vendorId })
			.getOne();

		if (vendor) {
			throw new BadRequestException(
				"This Vendor can't be deleted because it is used in expense records"
			);
		}

		return await this.delete(vendorId);
	}
}
