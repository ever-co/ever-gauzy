import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository, SelectQueryBuilder, WhereExpressionBuilder } from 'typeorm';
import { IEmailTemplate, IListQueryInput, IPagination } from '@gauzy/contracts';
import { CrudService } from './../core/crud';
import { EmailTemplate } from './email-template.entity';
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
		params: IListQueryInput<IEmailTemplate>
	): Promise<IPagination<IEmailTemplate>> {
		const { findInput } = params;
		const builder = this.repository.createQueryBuilder('email_template');
		builder.where((qb: SelectQueryBuilder<EmailTemplate>) => {
			qb.where(
				new Brackets((bck: WhereExpressionBuilder) => {
					const tenantId = RequestContext.currentTenantId();
					const { organizationId, languageCode } = findInput;
					if (organizationId) {
						bck.andWhere(`"${qb.alias}"."organizationId" = :organizationId`, {
							organizationId
						});
					}
					if (languageCode) {
						bck.andWhere(`"${qb.alias}"."languageCode" = :languageCode`, {
							languageCode
						});
					}
					bck.andWhere(`"${qb.alias}"."tenantId" = :tenantId`, {
						tenantId
					});
				})
			);
			qb.orWhere(
				new Brackets((bck: WhereExpressionBuilder) => {
					bck.andWhere(`"${qb.alias}"."organizationId" IS NULL`);
					bck.andWhere(`"${qb.alias}"."tenantId" IS NULL`);
				})
			)
		});
		const [items, total] = await builder.getManyAndCount();
		return { items, total };
	}
}