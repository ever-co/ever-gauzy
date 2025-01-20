import { FindOptionsWhere, MoreThan } from 'typeorm';
import { BadRequestException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import * as moment from 'moment';
import { sign, verify } from 'jsonwebtoken';
import { environment } from '@gauzy/config';
import { ID, IEstimateEmail, IEstimateEmailFindInput, IInvoice } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { TenantAwareCrudService } from './../core/crud';
import { EstimateEmail } from './estimate-email.entity';
import { TypeOrmEstimateEmailRepository } from './repository/type-orm-estimate-email.repository';
import { MikroOrmEstimateEmailRepository } from './repository/mikro-orm-estimate-email.repository';
import { TypeOrmInvoiceRepository } from './../invoice/repository/type-orm-invoice.repository';

@Injectable()
export class EstimateEmailService extends TenantAwareCrudService<EstimateEmail> {
	constructor(
		readonly typeOrmEstimateEmailRepository: TypeOrmEstimateEmailRepository,
		readonly mikroOrmEstimateEmailRepository: MikroOrmEstimateEmailRepository,
		private readonly typeOrmInvoiceRepository: TypeOrmInvoiceRepository
	) {
		super(typeOrmEstimateEmailRepository, mikroOrmEstimateEmailRepository);
	}

	/**
	 * Creates an estimate email entry and generates a JWT token for secure verification.
	 *
	 * @param {ID} id - The unique identifier of the invoice.
	 * @param {string} email - The recipient's email address.
	 * @returns {Promise<IEstimateEmail>} - A promise resolving to the created estimate email entry.
	 *
	 * @throws {HttpException} - Throws an `HttpException` if an error occurs during processing.
	 *
	 * @description
	 * This method retrieves the invoice and its associated organization, determines the token expiration,
	 * generates a JWT token, and saves the estimate email details, including the expiration date and security token.
	 */
	async createEstimateEmail(id: ID, email: string): Promise<IEstimateEmail> {
		try {
			const tenantId = RequestContext.currentTenantId();

			// Fetch invoice and organization details
			const invoice: IInvoice = await this.typeOrmInvoiceRepository.findOneOrFail({
				where: { id },
				relations: { organization: true }
			});

			// Define token expiration
			const tokenExpiryPeriod = invoice?.organization?.inviteExpiryPeriod ?? 7;
			const expireDate = moment().add(tokenExpiryPeriod, 'days').toDate();

			// Create payload for JWT
			const payload = {
				invoiceId: invoice.id,
				organizationId: invoice.organizationId,
				tenantId,
				email
			};

			// Generate JWT token
			const token = sign(payload, environment.JWT_SECRET, {
				expiresIn: `${moment.duration(moment(expireDate).diff(moment())).asSeconds()}s`
			});

			// Prepare and save estimate email entry
			return await this.typeOrmRepository.save(
				new EstimateEmail({
					organizationId: invoice.organizationId,
					tenantId: RequestContext.currentTenantId(),
					email,
					expireDate,
					convertAcceptedEstimates: invoice?.organization?.convertAcceptedEstimates ?? false,
					token
				})
			);
		} catch (error) {
			// Handle errors and return an appropriate error response
			throw new HttpException(`Failed to add estimate email: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
		}
	}

	/**
	 * Validate estimate email
	 *
	 * @param params
	 * @param relations
	 * @returns
	 */
	async validate(params: FindOptionsWhere<EstimateEmail>, relations: string[] = []): Promise<IEstimateEmail> {
		try {
			const decoded = verify(params.token as string, environment.JWT_SECRET) as IEstimateEmailFindInput;
			const { organizationId, tenantId, email, token } = decoded;

			return await this.typeOrmRepository.findOneOrFail({
				select: {
					tenant: {
						name: true,
						logo: true
					},
					organization: {
						name: true,
						officialName: true,
						brandColor: true
					}
				},
				where: {
					email,
					token,
					organizationId,
					tenantId,
					expireDate: MoreThan(moment().toDate())
				},
				...(relations
					? {
							relations: relations
					  }
					: {})
			});
		} catch (error) {
			throw new BadRequestException(error);
		}
	}
}
