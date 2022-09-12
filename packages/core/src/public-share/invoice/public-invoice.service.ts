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
			console.log({ relations });
			if (!params.id || !params.token) {
				throw new ForbiddenException();
			}
			const { id, organizationId, tenantId } = verify(params.token as string, environment.JWT_SECRET) as IInvoice;
			if (id !== params.id) {
				throw new ForbiddenException();
			}
			return await this.repository.findOneOrFail({
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
