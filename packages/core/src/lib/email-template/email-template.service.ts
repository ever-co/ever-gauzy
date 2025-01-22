import { Injectable } from '@nestjs/common';
import { Brackets, SelectQueryBuilder, WhereExpressionBuilder } from 'typeorm';
import * as mjml2html from 'mjml';
import { EmailTemplateEnum, IEmailTemplate, IPagination, LanguagesEnum } from '@gauzy/contracts';
import { isNotEmpty } from '@gauzy/common';
import { EmailTemplate } from './email-template.entity';
import { CrudService, PaginationParams } from './../core/crud';
import { RequestContext } from './../core/context';
import { prepareSQLQuery as p } from './../database/database.helper';
import { MikroOrmEmailTemplateRepository } from './repository/mikro-orm-email-template.repository';
import { TypeOrmEmailTemplateRepository } from './repository/type-orm-email-template.repository';

@Injectable()
export class EmailTemplateService extends CrudService<EmailTemplate> {
	constructor(
		typeOrmEmailTemplateRepository: TypeOrmEmailTemplateRepository,
		mikroOrmEmailTemplateRepository: MikroOrmEmailTemplateRepository
	) {
		super(typeOrmEmailTemplateRepository, mikroOrmEmailTemplateRepository);
	}

	/**
	 * Get Email Templates
	 * @param params
	 * @returns
	 */
	async findAll(params: PaginationParams<EmailTemplate>): Promise<IPagination<IEmailTemplate>> {
		const query = this.typeOrmRepository.createQueryBuilder('email_template');
		query.setFindOptions({
			select: {
				organization: {
					id: true,
					name: true,
					brandColor: true
				}
			},
			...(params && params.relations
				? {
						relations: params.relations
				  }
				: {}),
			...(params && params.order
				? {
						order: params.order
				  }
				: {})
		});
		query.where((qb: SelectQueryBuilder<EmailTemplate>) => {
			qb.where(
				new Brackets((web: WhereExpressionBuilder) => {
					const { tenantId, organizationId, languageCode } = params.where;
					if (isNotEmpty(tenantId)) {
						web.andWhere(p(`"${qb.alias}"."tenantId" = :tenantId`), {
							tenantId: RequestContext.currentTenantId()
						});
					}
					if (isNotEmpty(organizationId)) {
						web.andWhere(p(`"${qb.alias}"."organizationId" = :organizationId`), {
							organizationId
						});
					}
					if (isNotEmpty(languageCode)) {
						web.andWhere(p(`"${qb.alias}"."languageCode" = :languageCode`), {
							languageCode
						});
					}
				})
			);
			qb.orWhere(
				new Brackets((web: WhereExpressionBuilder) => {
					web.andWhere(p(`"${qb.alias}"."organizationId" IS NULL`));
					web.andWhere(p(`"${qb.alias}"."tenantId" IS NULL`));
				})
			);
		});
		const [items, total] = await query.getManyAndCount();
		return { items, total };
	}

	/**
	 * Insert or update global missing email templates in database.
	 * Production environment not running any seeder to save templates.
	 * If someone looking for templates, we are fetch it from code folders.
	 *
	 * @param languageCode
	 * @param name
	 * @param type
	 * @param organizationId
	 * @param tenantId
	 * @param content
	 * @returns
	 */
	async saveTemplate(
		languageCode: LanguagesEnum,
		name: EmailTemplateEnum,
		type: 'html' | 'subject',
		organizationId: string,
		tenantId: string,
		content: IEmailTemplate
	): Promise<IEmailTemplate> {
		let entity: IEmailTemplate;
		try {
			const emailTemplate = await this.findOneByWhereOptions({
				languageCode,
				name: `${name}/${type}`,
				organizationId,
				tenantId
			});
			switch (type) {
				case 'subject':
					entity = {
						...emailTemplate,
						hbs: content.hbs
					};
					break;
				case 'html':
					entity = {
						...emailTemplate,
						mjml: content.mjml,
						hbs: mjml2html(content.mjml).html
					};
					break;
			}
			await super.create({ id: emailTemplate.id, ...entity });
		} catch (error) {
			entity = new EmailTemplate({
				organizationId,
				tenantId,
				languageCode
			});
			entity.name = `${name}/${type}`;
			switch (type) {
				case 'subject':
					entity.hbs = content.hbs;
					break;
				case 'html':
					entity.mjml = content.mjml;
					entity.hbs = mjml2html(content.mjml).html;
					break;
			}
			await super.create(entity);
		}
		return entity;
	}
}
