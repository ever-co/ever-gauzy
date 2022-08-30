import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository, SelectQueryBuilder, WhereExpressionBuilder } from 'typeorm';
import { IEmailTemplate, IPagination } from '@gauzy/contracts';
import { isNotEmpty } from '@gauzy/common';
import { EmailTemplate } from './email-template.entity';
import { CrudService, PaginationParams } from './../core/crud';
import { RequestContext } from './../core/context';

@Injectable()
export class EmailTemplateService extends CrudService<EmailTemplate> {
	constructor(
		@InjectRepository(EmailTemplate)
		private readonly emailRepository: Repository<EmailTemplate>
	) {
		super(emailRepository);
	}

	/**
	* Get Email Templates
	* @param params
	* @returns
	*/
	async findAll(
		params: PaginationParams<EmailTemplate>
	): Promise<IPagination<IEmailTemplate>> {
		const query = this.repository.createQueryBuilder('email_template');
		query.setFindOptions({
			select: {
				organization: {
					id: true,
					name: true,
					brandColor: true
				}
			},
			...(
				(params && params.relations) ? {
					relations: params.relations
				} : {}
			),
			...(
				(params && params.order) ? {
					order: params.order
				} : {}
			)
		});
		query.where((qb: SelectQueryBuilder<EmailTemplate>) => {
			qb.where(
				new Brackets((web: WhereExpressionBuilder) => {
					const { tenantId, organizationId, languageCode } = params.where;
					if (isNotEmpty(tenantId)) {
						web.andWhere(`"${qb.alias}"."tenantId" = :tenantId`, {
							tenantId: RequestContext.currentTenantId()
						});
					}
					if (isNotEmpty(organizationId)) {
						web.andWhere(`"${qb.alias}"."organizationId" = :organizationId`, {
							organizationId
						});
					}
					if (isNotEmpty(languageCode)) {
						web.andWhere(`"${qb.alias}"."languageCode" = :languageCode`, {
							languageCode
						});
					}
				})
			);
			qb.orWhere(
				new Brackets((web: WhereExpressionBuilder) => {
					web.andWhere(`"${qb.alias}"."organizationId" IS NULL`);
					web.andWhere(`"${qb.alias}"."tenantId" IS NULL`);
				})
			)
		});
		const [items, total] = await query.getManyAndCount();
		return { items, total };
	}
}