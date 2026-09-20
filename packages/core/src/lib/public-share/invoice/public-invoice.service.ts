import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, IsNull, MoreThan, Repository, UpdateResult } from 'typeorm';
import { IInvoice, IInvoiceUpdateInput } from '@gauzy/contracts';
import { EstimateEmail, Invoice } from './../../core/entities/internal';
import { parseFindOptionsRelations } from '../../core/utils';
import { TypeOrmInvoiceRepository } from '../../invoice/repository/type-orm-invoice.repository';
import { isNonEmptyString, TokenPurposeEnum, verifyPurposeToken } from '../../auth/purpose-token';

@Injectable()
export class PublicInvoiceService {
	constructor(
		@InjectRepository(Invoice)
		private readonly typeOrmInvoiceRepository: TypeOrmInvoiceRepository,
		@InjectRepository(EstimateEmail)
		private readonly typeOrmEstimateEmailRepository: Repository<EstimateEmail>
	) {}

	/**
	 * Find public invoice by token
	 *
	 * @param params
	 * @param relations
	 * @returns
	 */
	async findOneByConditions(params: FindOptionsWhere<Invoice>, relations: string[] = []): Promise<IInvoice> {
		const { id, token } = params;
		if (!isNonEmptyString(id) || !isNonEmptyString(token)) {
			throw new ForbiddenException();
		}

		// The link must be a share token for THIS invoice. Every JWT_SECRET-signed token used to be
		// accepted and the lookup was built from its claims alone, so a token of another kind
		// (appointment, invite, estimate, ...) dropped the missing claims from the `where` and read an
		// arbitrary invoice (GHSA-28wv-vrxj-rp4q). Links mailed before share tokens were typed carry
		// no purpose; they are still accepted because the token must ALSO equal the stored
		// `invoice.token` below, which is exactly the string that was shared.
		let tenantId: string;
		try {
			const decoded = verifyPurposeToken<{ id: string; tenantId: string }>(
				token,
				TokenPurposeEnum.INVOICE_SHARE,
				{
					requiredClaims: ['id', 'tenantId'],
					allowLegacyUntyped: true
				}
			);
			if (decoded.id !== id) {
				throw new ForbiddenException();
			}
			tenantId = decoded.tenantId;
		} catch (error) {
			throw new ForbiddenException();
		}

		try {
			// Get invoice
			return await this.typeOrmInvoiceRepository.findOneOrFail({
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
					fromOrganization: {
						name: true,
						officialName: true,
						brandColor: true
					},
					invoiceItems: {
						id: true,
						description: true,
						quantity: true,
						price: true,
						totalValue: true,
						applyDiscount: true,
						employeeId: true,
						employee: {
							id: true,
							userId: true,
							user: {
								id: true,
								firstName: true,
								lastName: true
							}
						},
						projectId: true,
						project: {
							id: true,
							imageUrl: true,
							name: true,
							description: true
						},
						productId: true,
						product: {
							id: true,
							code: true,
							imageUrl: true
						},
						expenseId: true,
						expense: {
							id: true,
							purpose: true
						},
						taskId: true,
						task: {
							id: true,
							title: true,
							description: true
						}
					},
					toContact: {
						id: true,
						contactType: true,
						imageUrl: true,
						name: true
					}
				},
				// Bound to the stored share token: regenerating the link revokes the old one.
				where: {
					id,
					token,
					tenantId
				},
				...(relations ? { relations: parseFindOptionsRelations(relations) } : {})
			});
		} catch (error) {
			throw new ForbiddenException();
		}
	}

	/**
	 * Update public invoice
	 *
	 * @param params
	 * @param entity
	 * @returns
	 */
	async updateInvoice(params: IInvoice, entity: IInvoiceUpdateInput): Promise<IInvoice | UpdateResult> {
		try {
			let decoded: { invoiceId: string; tenantId: string; organizationId?: string | null };
			try {
				// Only an estimate-email token (estimate-email.service.ts) may accept or reject an estimate.
				// Legacy (untyped) estimate tokens are accepted because the token must also match a live
				// `estimate_email` row below.
				decoded = verifyPurposeToken(params.token, TokenPurposeEnum.ESTIMATE, {
					requiredClaims: ['invoiceId', 'tenantId'],
					allowLegacyUntyped: true
				});
			} catch {
				throw new ForbiddenException('Invalid estimate token');
			}
			// Without this check a missing `invoiceId` was dropped from the where and `findOneByOrFail`
			// matched an ARBITRARY invoice of that organization/tenant, which was then updated with the
			// caller's body. The token must also name the invoice in the URL.
			const invoiceId = decoded.invoiceId;
			if (invoiceId !== params.id) {
				throw new ForbiddenException('Invalid estimate token');
			}

			// Bind to the stored, unexpired estimate email: deleting or expiring it revokes the link
			// (GHSA-28wv-vrxj-rp4q).
			const estimateEmail = await this.typeOrmEstimateEmailRepository.findOne({
				where: {
					token: params.token,
					tenantId: decoded.tenantId,
					expireDate: MoreThan(new Date())
				}
			});
			if (!estimateEmail) {
				throw new ForbiddenException('Invalid estimate token');
			}

			const invoice = await this.typeOrmInvoiceRepository.findOneByOrFail({
				id: invoiceId,
				organizationId: decoded.organizationId ?? IsNull(),
				tenantId: decoded.tenantId
			});
			return await this.typeOrmInvoiceRepository.update(invoice.id, entity);
		} catch (error) {
			if (error instanceof ForbiddenException) {
				throw error;
			}
			throw new BadRequestException(error);
		}
	}
}
