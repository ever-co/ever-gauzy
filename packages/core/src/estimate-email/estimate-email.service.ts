import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { FindOptionsWhere } from 'typeorm/find-options/FindOptionsWhere';
import { BadRequestException, Injectable } from '@nestjs/common';
import * as moment from 'moment';
import { sign, verify } from 'jsonwebtoken';
import { environment } from '@gauzy/config';
import { IEstimateEmail, IEstimateEmailFindInput, IInvoice, IOrganization } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { TenantAwareCrudService } from './../core/crud';
import { Invoice, Organization } from './../core/entities/internal';
import { EstimateEmail } from './estimate-email.entity';

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

	async createEstimateEmail(
		id: string,
		email: string
	): Promise<IEstimateEmail> {
		const invoice: IInvoice = await this.invoiceRepository.findOneByOrFail({
			id
		});
		const organization: IOrganization = await this.organizationRepository.findOneBy({
			id: invoice.organizationId
		});
		try {
			const payload = {
				invoiceId: invoice.id,
				organizationId: invoice.organizationId,
				tenantId: RequestContext.currentTenantId(),
				email
			}
			const tokenExpiryPeriod = organization.inviteExpiryPeriod || 7;
			const now = moment();
			const expireDate = now.clone().add(tokenExpiryPeriod, 'days');
			const duration = moment.duration(expireDate.diff(now)).asSeconds();

			const estimateEmail = new EstimateEmail();
			estimateEmail.organizationId = invoice.organizationId;
			estimateEmail.tenantId = RequestContext.currentTenantId();
			estimateEmail.email = email;
			estimateEmail.expireDate = expireDate.toDate();
			estimateEmail.convertAcceptedEstimates = organization.convertAcceptedEstimates || false;
			estimateEmail.token = sign(payload, environment.JWT_SECRET, {
				expiresIn: `${duration}s`
			});
			return await this.repository.save(estimateEmail);
		} catch (error) {
			throw new BadRequestException(error);
		}
	}

	/**
	 * Validate estimate email
	 *
	 * @param params
	 * @param relations
	 * @returns
	 */
	async validate(
		params: FindOptionsWhere<EstimateEmail>,
		relations: string[] = []
	): Promise<IEstimateEmail> {
		try {
			const decoded = verify(params.token as string, environment.JWT_SECRET) as IEstimateEmailFindInput;
			const { organizationId, tenantId, email, token } = decoded;

			return await this.repository.findOneOrFail({
				select: {
					tenant: {
						name: true,
						logo: true
					},
					organization: {
						name: true,
						officialName: true,
						brandColor: true
					},
				},
				where: {
					email,
					token,
					organizationId,
					tenantId,
					expireDate: MoreThan(moment().toDate())
				},
				...(
					(relations) ? {
						relations: relations
					} : {}
				),
			});
		} catch (error) {
			throw new BadRequestException(error);
		}
	}
}
