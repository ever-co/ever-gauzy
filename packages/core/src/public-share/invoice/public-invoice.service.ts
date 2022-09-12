import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { verify } from 'jsonwebtoken';
import { IInvoice } from '@gauzy/contracts';
import { environment } from '@gauzy/config';
import { Invoice } from './../../core/entities/internal';

@Injectable()
export class PublicInvoiceService {

	constructor(
		@InjectRepository(Invoice)
		private readonly repository: Repository<Invoice>
	) {}

	/**
	 * Find public invoice by token
	 *
	 * @param params
	 * @param relations
	 * @returns
	 */
	async findOneByConditions(
		params: FindOptionsWhere<Invoice>,
		relations: string[] = []
	): Promise<any> {
		try {
			if (!params.id || !params.token) {
				throw new ForbiddenException();
			}
			const { id, organizationId, tenantId } = verify(params.token as string, environment.JWT_SECRET) as IInvoice;
			if (id !== params.id) {
				throw new ForbiddenException();
			}
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
							user: {
								firstName: true,
								lastName: true,
							}
						},
						projectId: true,
						project: {
							imageUrl: true,
							name: true,
							description: true
						},
						productId: true,
						expenseId: true,
						expense: {
							purpose: true
						},
						taskId: true,
						task: {
							title: true,
							description: true,
						}
					},
					toContact: {
						contactType: true,
						imageUrl: true,
						name: true,
					}
				},
				where: {
					id,
					organizationId,
					tenantId
				},
				...(
					(relations) ? {
						relations: relations
					} : {}
				),
			});
		} catch (error) {
			throw new ForbiddenException();
		}
	}
}
