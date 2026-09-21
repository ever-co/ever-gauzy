import { Injectable } from '@nestjs/common';
import { Brackets, IsNull, SelectQueryBuilder, WhereExpressionBuilder } from 'typeorm';
import { EmailTemplateEnum, IEmailTemplate, IPagination, LanguagesEnum } from '@gauzy/contracts';
import { isEmpty, isNotEmpty } from '@gauzy/utils';
import { EmailTemplate } from './email-template.entity';
import { CrudService, BaseQueryDTO } from './../core/crud';
import { IFindManyOptions } from './../core/crud/icrud.service';
import { scopeEmailTemplateWhere } from './email-template.scope';
import { MultiORMEnum } from './../core/utils';
import { RequestContext } from './../core/context';
import { prepareSQLQuery as p } from './../database/database.helper';
import { compileMjml } from './compile-mjml';
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
	async findAll(params: BaseQueryDTO<EmailTemplate>): Promise<IPagination<IEmailTemplate>> {
		// Builds its own query, so the check in the CRUD read methods never runs: assert the
		// sensitive-relation table on the client-supplied relations before anything is loaded.
		this.assertRelationsPermitted(params);

		switch (this.ormType) {
			case MultiORMEnum.MikroORM: {
				const { organizationId: mOrgId, languageCode: mLang } = params.where ?? {};
				const mTenantId = RequestContext.currentTenantId();

				// The caller's tenant is never taken from the client (GHSA-44pv-34gx-q9p4), and the tenant
				// arm exists only when the context HAS a tenant: MikroORM compiles a literal `null` to
				// `IS NULL`, so a `tenantId: null` arm would not match nothing — it would match every
				// NULL-tenant row, organization-scoped ones included. Without a tenant, only the global
				// defaults (`tenantId IS NULL AND organizationId IS NULL`) are readable.
				const mGlobalArm = { organizationId: null, tenantId: null };
				const mTenantArm = {
					tenantId: mTenantId,
					...(isNotEmpty(mOrgId) ? { organizationId: mOrgId } : {}),
					...(isNotEmpty(mLang) ? { languageCode: mLang } : {})
				};
				const mWhere = { $or: mTenantId ? [mTenantArm, mGlobalArm] : [mGlobalArm] };

				const [mItems, mTotal] = await this.mikroOrmRepository.findAndCount(mWhere as any, {
					...(params?.relations ? { populate: Object.keys(params.relations) as any[] } : {}),
					...(params?.order ? { orderBy: params.order as any } : {})
				});
				return { items: mItems.map((item) => this.serialize(item)), total: mTotal };
			}

			case MultiORMEnum.TypeORM: {
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
							const { organizationId, languageCode } = params.where ?? {};
							// Always pinned to the caller's tenant. This used to run only when the CLIENT
							// sent `where.tenantId`, so omitting it listed every tenant's templates
							// (GHSA-44pv-34gx-q9p4). A missing context tenant binds NULL and matches nothing.
							web.andWhere(p(`"${qb.alias}"."tenantId" = :tenantId`), {
								tenantId: RequestContext.currentTenantId() ?? null
							});
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

			default:
				throw new Error(`Not implemented for ${this.ormType}`);
		}
	}

	/**
	 * Paginates email templates of the caller's tenant plus the global (NULL-tenant) defaults.
	 *
	 * Inherited `GET /email-template/pagination` used to hand the client `where` straight to
	 * `CrudService.paginate`, which adds no tenant predicate on this plain `CrudService`
	 * (GHSA-44pv-34gx-q9p4).
	 *
	 * @param options - The client pagination options.
	 * @returns The paginated templates.
	 */
	public async paginate(options?: IFindManyOptions<EmailTemplate>): Promise<IPagination<EmailTemplate>> {
		const where = scopeEmailTemplateWhere(
			(options as { where?: unknown } | undefined)?.where,
			RequestContext.currentTenantId(),
			this.ormType
		);
		return await super.paginate({ ...options, where } as IFindManyOptions<EmailTemplate>);
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
			// A missing organization / tenant means the GLOBAL template row (IS NULL) — say so with the
			// explicit operator. This service is a plain CrudService (no tenant scoping), and a literal
			// null used to be dropped from the SQL, so the "global" lookup matched — and then overwrote —
			// another tenant's template of the same name (GHSA-44pv-34gx-q9p4 class).
			const emailTemplate = await this.findOneByWhereOptions({
				languageCode,
				name: `${name}/${type}`,
				organizationId: isEmpty(organizationId) ? IsNull() : organizationId,
				tenantId: isEmpty(tenantId) ? IsNull() : tenantId
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
						hbs: compileMjml(content.mjml).html
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
					entity.hbs = compileMjml(content.mjml).html;
					break;
			}
			await super.create(entity);
		}
		return entity;
	}
}
