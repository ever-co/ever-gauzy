import { RequestContext } from '../core';
import { TenantAwareCrudService } from './../core/crud';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { EstimateEmail } from './estimate-email.entity';
import { addDays } from 'date-fns';
import { Invoice } from '../invoice/invoice.entity';
import { Organization } from '../organization/organization.entity';

@Injectable()
export class EstimateEmailService extends TenantAwareCrudService<EstimateEmail> {
	constructor(
		@InjectRepository(EstimateEmail)
		private readonly estimateEmailRepository: Repository<EstimateEmail>,
		@InjectRepository(Invoice)
		private readonly invoiceRepository: Repository<Invoice>,
		@InjectRepository(Organization)
		private readonly organizationRepository: Repository<Organization>
	) {
		super(estimateEmailRepository);
	}

	async createEstimateEmail(id: string, email: string, token: string) {
		const invoice: Invoice = await this.invoiceRepository.findOne(id);
		const organization: Organization = await this.organizationRepository.findOne(
			invoice.organizationId
		);

		const tokenExpiryPeriod =
			organization && organization.inviteExpiryPeriod
				? organization.inviteExpiryPeriod
				: 7;

		const expireDate = addDays(new Date(), tokenExpiryPeriod);

		const estimateEmail = new EstimateEmail();

		estimateEmail.organizationId = organization ? organization.id : null;
		estimateEmail.tenantId = RequestContext.currentTenantId();
		estimateEmail.email = email;
		estimateEmail.token = token;
		estimateEmail.expireDate = expireDate;
		estimateEmail.convertAcceptedEstimates = organization
			? organization.convertAcceptedEstimates
			: false;

		await this.repository.save(estimateEmail);
	}

	async validate(relations, email, token): Promise<EstimateEmail> {
		return this.findOneByOptions({
			relations,
			where: {
				email,
				token,
				expireDate: MoreThanOrEqual(new Date())
			}
		});
	}
}
