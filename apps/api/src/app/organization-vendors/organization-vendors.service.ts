import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrudService } from '../core/crud/crud.service';
import { OrganizationVendor } from './organization-vendors.entity';
import { Expense } from '../expense/expense.entity';

@Injectable()
export class OrganizationVendorsService extends CrudService<
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
