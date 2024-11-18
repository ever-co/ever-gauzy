import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, UpdateResult } from 'typeorm';
import { verify } from 'jsonwebtoken';
import { IInvoice, IInvoiceUpdateInput } from '@gauzy/contracts';
import { environment } from '@gauzy/config';
import { Invoice } from './../../core/entities/internal';
import { TypeOrmInvoiceRepository } from '../../invoice/repository/type-orm-invoice.repository';

@Injectable()
export class PublicInvoiceService {
	constructor(
		@InjectRepository(Invoice)
		private readonly typeOrmInvoiceRepository: TypeOrmInvoiceRepository
	) {}

	/**
	 * Find public invoice by token
	 *
	 * @param params
	 * @param relations
	 * @returns
	 */
	async findOneByConditions(params: FindOptionsWhere<Invoice>, relations: string[] = []): Promise<IInvoice> {
		if (!params.id || !params.token) {
			throw new ForbiddenException();
		}

		try {
			// verify token
			const { id, organizationId, tenantId } = verify(params.token as string, environment.JWT_SECRET) as IInvoice;

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
				where: {
					id,
					organizationId,
					tenantId
				},
				...(relations ? { relations: relations } : {})
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
			const decoded = verify(params.token as string, environment.JWT_SECRET) as any;
			const invoice = await this.typeOrmInvoiceRepository.findOneByOrFail({
				id: decoded.invoiceId,
				organizationId: decoded.organizationId,
				tenantId: decoded.tenantId
			});
			return await this.typeOrmInvoiceRepository.update(invoice.id, entity);
		} catch (error) {
			throw new BadRequestException(error);
		}
	}
}
