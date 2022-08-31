import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, SelectQueryBuilder, Brackets, WhereExpressionBuilder,  } from 'typeorm';
import { Candidate } from './candidate.entity';
import { ICandidateCreateInput } from '@gauzy/contracts';
import { TenantAwareCrudService } from './../core/crud';
import { isNotEmpty } from '@gauzy/common';
import { RequestContext } from 'core/context';

@Injectable()
export class CandidateService extends TenantAwareCrudService<Candidate> {
	constructor(
		@InjectRepository(Candidate)
		private readonly candidateRepository: Repository<Candidate>
	) {
		super(candidateRepository);
	}

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
			const query = this.repository.createQueryBuilder('candidate');
			query.setFindOptions({
				skip: (options && options.skip) ? (options.take * (options.skip - 1)) : 0,
				take: (options && options.take) ? (options.take) : 10,
				...(
					(options && options.relations) ? {
						relations: options.relations
					} : {}
				),
				...(
					(options && options.join) ? {
						join: options.join
					} : {}
				),
			});
			query.where((qb: SelectQueryBuilder<Candidate>) => {
				qb.andWhere(
					new Brackets((web: WhereExpressionBuilder) => {
						web.andWhere(`"${qb.alias}"."tenantId" = :tenantId`, {
							tenantId: RequestContext.currentTenantId()
						});
						if (isNotEmpty(options.where)) {
							const { where } = options;
							if (isNotEmpty(where.organizationId)) {
								const { organizationId } = where;
								web.andWhere(`"${qb.alias}"."organizationId" = :organizationId`, {
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
							if (
								isNotEmpty(where.isArchived) &&
								isNotEmpty(Boolean(JSON.parse(where.isArchived)))
							) {
								web.andWhere(`"${qb.alias}"."isArchived" = :isArchived`, {
									isArchived: false
								});
							}
						})
					);
					qb.andWhere(
						new Brackets((web: WhereExpressionBuilder) => {
							if (isNotEmpty(where.tags)) {
								const { tags } = where;
								web.andWhere(`"tags"."id" IN (:...tags)`, { tags });
							}
						})
					);
					qb.andWhere(
						new Brackets((web: WhereExpressionBuilder) => {
							if (isNotEmpty(where.user)) {
								if (isNotEmpty(where.user.name)) {
									const keywords: string[] = where.user.name.split(' ');
									keywords.forEach((keyword: string, index: number) => {
										web.orWhere(`LOWER("user"."firstName") like LOWER(:keyword_${index})`, {
											[`keyword_${index}`]:`%${keyword}%`
										});
										web.orWhere(`LOWER("user"."lastName") like LOWER(:${index}_keyword)`, {
											[`${index}_keyword`]:`%${keyword}%`
										});
									});
								}
								if (isNotEmpty(where.user.email)) {
									const { email } = where.user;
									web.orWhere(`LOWER("user"."email") like LOWER(:email)`, {
										email:`%${email}%`
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
