import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrganizationVendor } from './organization-vendor.entity';
import { Expense } from '../expense/expense.entity';
import { TenantAwareCrudService } from './../core/crud';

@Injectable()
export class OrganizationVendorService extends TenantAwareCrudService<OrganizationVendor> {
	constructor(
		@InjectRepository(OrganizationVendor)
		private readonly organizationVendorRepository: Repository<OrganizationVendor>
	) {
		super(organizationVendorRepository);
	}

	async deleteVendor(vendorId) {
		const vendor = await this.organizationVendorRepository
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
