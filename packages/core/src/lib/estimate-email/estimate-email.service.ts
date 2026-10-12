import { FindOptionsWhere, MoreThan } from 'typeorm';
import { BadRequestException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import * as moment from 'moment';
import { ID, IEstimateEmail, IInvoice } from '@gauzy/contracts';
import { isNonEmptyString, signPurposeToken, TokenPurposeEnum, verifyPurposeToken } from '../auth/purpose-token';
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
			const tokenExpiryPeriod = invoice.organization?.inviteExpiryPeriod ?? 7;
			const expireDate = moment().add(tokenExpiryPeriod, 'days').toDate();

			// Create payload for JWT
			const payload = {
				invoiceId: invoice.id,
				organizationId: invoice.organizationId,
				tenantId,
				email
			};

			// Generate JWT token
			const token = signPurposeToken(TokenPurposeEnum.ESTIMATE, payload, {
				expiresIn: `${moment.duration(moment(expireDate).diff(moment())).asSeconds()}s`
			});

			// Prepare and save estimate email entry
			return await this.save(
				new EstimateEmail({
					organizationId: invoice.organizationId,
					tenantId: RequestContext.currentTenantId(),
					email,
					expireDate,
					convertAcceptedEstimates: invoice.organization?.convertAcceptedEstimates ?? false,
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
			const { email, token } = params;
			if (!isNonEmptyString(email) || !isNonEmptyString(token)) {
				throw new BadRequestException();
			}

			// The token must be an estimate token for the email in the link, and the lookup is bound
			// to the STORED token. The old code read a `token` claim that is never minted and ignored
			// the query email, so a token of another kind (e.g. an appointment token) reduced the
			// `where` to `expireDate > now` and returned another tenant's row, token included
			// (GHSA-28wv-vrxj-rp4q). Untyped (legacy) estimate tokens still match their stored row.
			const decoded = verifyPurposeToken<{
				invoiceId: string;
				organizationId: string;
				tenantId: string;
				email: string;
			}>(token, TokenPurposeEnum.ESTIMATE, {
				requiredClaims: ['invoiceId', 'organizationId', 'tenantId', 'email'],
				allowLegacyUntyped: true
			});
			if (decoded.email.trim().toLowerCase() !== email.trim().toLowerCase()) {
				throw new BadRequestException();
			}
			const { organizationId, tenantId } = decoded;

			const result = await this.findOneOrFailByOptions({
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
					email: decoded.email,
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
			if (!result.success) {
				throw result.error;
			}
			return result.record;
		} catch (error) {
			throw new BadRequestException(error);
		}
	}
}
