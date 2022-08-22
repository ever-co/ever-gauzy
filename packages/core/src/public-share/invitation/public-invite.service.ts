import { isNotEmpty } from '@gauzy/common';
import { IInvite, InviteStatusEnum } from '@gauzy/contracts';
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
	Brackets,
	FindOptionsWhere,
	IsNull,
	MoreThanOrEqual,
	Repository,
	SelectQueryBuilder,
	WhereExpressionBuilder
} from 'typeorm';
import { Invite } from './../../core/entities/internal';

@Injectable()
export class PublicInviteService {

	constructor(
		@InjectRepository(Invite)
		private readonly repository: Repository<Invite>
	) {}

	/**
	 * Check, if invite exist or expired for user
	 *
	 * @param where
	 * @param relations
	 * @returns
	 */
	async validate(
		where: FindOptionsWhere<Invite>,
		relations: string[] = []
	): Promise<IInvite> {
		try {
			const query = this.repository.createQueryBuilder();
			query.setFindOptions({
				select: {
					id: true,
					status: true,
					organization: {
						id: true,
						name: true
					}
				},
				...(
					(isNotEmpty(relations)) ? {
						relations: relations
					} : {}
				),
			});
			query.where((qb: SelectQueryBuilder<Invite>) => {
				qb.where({
					...where,
					status: InviteStatusEnum.INVITED
				})
				qb.andWhere(
					new Brackets((web: WhereExpressionBuilder) => {
						web.where(
							[
								{
									expireDate: MoreThanOrEqual(new Date())
								},
								{
									expireDate: IsNull()
								}
							]
						);
					})
				);
			});
			return await query.getOneOrFail();
		} catch (error) {
			throw new BadRequestException();
		}
	}
}
