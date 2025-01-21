import { BadRequestException, Injectable } from '@nestjs/common';
import { SelectQueryBuilder, Brackets, WhereExpressionBuilder } from 'typeorm';
import { ICandidateCreateInput } from '@gauzy/contracts';
import { isNotEmpty } from '@gauzy/common';
import { Candidate } from './candidate.entity';
import { TenantAwareCrudService } from './../core/crud';
import { RequestContext } from './../core/context';
import { prepareSQLQuery as p } from './../database/database.helper';
import { TypeOrmCandidateRepository } from './repository/type-orm-candidate.repository';
import { MikroOrmCandidateRepository } from './repository/mikro-orm-candidate.repository';

@Injectable()
export class CandidateService extends TenantAwareCrudService<Candidate> {
	constructor(
		readonly typeOrmCandidateRepository: TypeOrmCandidateRepository,
		readonly mikroOrmCandidateRepository: MikroOrmCandidateRepository
	) {
		super(typeOrmCandidateRepository, mikroOrmCandidateRepository);
	}

	/**
	 *
	 * @param input
	 * @returns
	 */
	async createBulk(input: ICandidateCreateInput[]) {
		return Promise.all(
			input.map((candidate) => {
				candidate.user.tenant = {
					id: candidate.organization.tenantId
				};
				return this.create(candidate);
			})
		);
	}

	/**
	 * Candidate Custom Pagination
	 *
	 * @param options
	 * @returns
	 */
	public async pagination(options: any) {
		try {
			const query = this.typeOrmRepository.createQueryBuilder('candidate');
			query.setFindOptions({
				skip: options && options.skip ? options.take * (options.skip - 1) : 0,
				take: options && options.take ? options.take : 10,
				...(options && options.relations
					? {
							relations: options.relations
					  }
					: {}),
				...(options && options.join
					? {
							join: options.join
					  }
					: {})
			});
			query.where((qb: SelectQueryBuilder<Candidate>) => {
				qb.andWhere(
					new Brackets((web: WhereExpressionBuilder) => {
						web.andWhere(p(`"${qb.alias}"."tenantId" = :tenantId`), {
							tenantId: RequestContext.currentTenantId()
						});
						if (isNotEmpty(options.where)) {
							const { where } = options;
							if (isNotEmpty(where.organizationId)) {
								const { organizationId } = where;
								web.andWhere(p(`"${qb.alias}"."organizationId" = :organizationId`), {
									organizationId
								});
							}
						}
					})
				);
				if (isNotEmpty(options.where)) {
					const { where } = options;
					qb.andWhere(
						new Brackets((web: WhereExpressionBuilder) => {
							if (isNotEmpty(where.isArchived) && isNotEmpty(Boolean(JSON.parse(where.isArchived)))) {
								web.andWhere(p(`"${qb.alias}"."isArchived" = :isArchived`), {
									isArchived: false
								});
							}
						})
					);
					qb.andWhere(
						new Brackets((web: WhereExpressionBuilder) => {
							if (isNotEmpty(where.tags)) {
								const { tags } = where;
								web.andWhere(p(`"tags"."id" IN (:...tags)`), { tags });
							}
						})
					);
					qb.andWhere(
						new Brackets((web: WhereExpressionBuilder) => {
							if (isNotEmpty(where.user)) {
								if (isNotEmpty(where.user.name)) {
									const keywords: string[] = where.user.name.split(' ');
									keywords.forEach((keyword: string, index: number) => {
										web.orWhere(p(`LOWER("user"."firstName") like LOWER(:keyword_${index})`), {
											[`keyword_${index}`]: `%${keyword}%`
										});
										web.orWhere(p(`LOWER("user"."lastName") like LOWER(:${index}_keyword)`), {
											[`${index}_keyword`]: `%${keyword}%`
										});
									});
								}
								if (isNotEmpty(where.user.email)) {
									const { email } = where.user;
									web.orWhere(p(`LOWER("user"."email") like LOWER(:email)`), {
										email: `%${email}%`
									});
								}
							}
						})
					);
				}
			});
			const [items, total] = await query.getManyAndCount();
			return { items, total };
		} catch (error) {
			throw new BadRequestException(error);
		}
	}
}
