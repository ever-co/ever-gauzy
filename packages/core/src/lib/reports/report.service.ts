import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import { GetReportMenuItemsInput, ID, IPagination, IReport } from '@gauzy/contracts';
import { CrudService } from '../core/crud';
import { MultiORMEnum, parseFindOptionsRelations } from '../core/utils';
import { RequestContext } from './../core/context';
import { Report } from './report.entity';
import { assertReportCatalogueAuthoringEnabled, REPORT_CATALOGUE_TEXT_MAX, ReportCategoryService } from './report-category.service';
import { REPORT_SLUG_PATTERN } from './dto/report-authoring.dto';
import { MikroOrmReportRepository } from './repository/mikro-orm-report.repository';
import { TypeOrmReportRepository } from './repository/type-orm-report.repository';

/** The members a caller states when it files a report into the catalogue. */
export interface IReportCreateInput {
	name: string;
	slug: string;
	description?: string;
	image?: string;
	iconClass?: string;
	categoryId: ID;
}

@Injectable()
export class ReportService extends CrudService<Report> {
	private readonly logger = new Logger(ReportService.name);

	constructor(
		readonly typeOrmReportRepository: TypeOrmReportRepository,
		readonly mikroOrmReportRepository: MikroOrmReportRepository,
		private readonly reportCategoryService: ReportCategoryService
	) {
		super(typeOrmReportRepository, mikroOrmReportRepository);
	}

	/**
	 * Files one report into the platform-wide catalogue.
	 *
	 * The catalogue has no tenant, so the entry is offered to every organization's menu — where each
	 * organization still switches it on for itself — and both routes that reach this are gated to
	 * `SUPER_ADMIN`. The members are checked here rather than by a DTO alone, because the GraphQL input
	 * reaches this method without one: the slug is the key a client routes by, so it must be well-formed and
	 * not already taken by a live report, and the category must be a live one. `showInMenu` starts `false`:
	 * it is computed per organization from that organization's menu rows, never stored as a decision here.
	 *
	 * @param input The report's members and its category.
	 * @returns The report.
	 * @throws BadRequestException when a member is malformed.
	 * @throws NotFoundException when there is no such live category.
	 * @throws ConflictException when a live report already has the slug.
	 */
	async createReport(input: IReportCreateInput): Promise<Report> {
		assertReportCatalogueAuthoringEnabled();
		const name = typeof input?.name === 'string' ? input.name.trim() : '';
		const slug = typeof input?.slug === 'string' ? input.slug.trim() : '';

		if (!name || name.length > REPORT_CATALOGUE_TEXT_MAX) {
			throw new BadRequestException(`name must be 1 to ${REPORT_CATALOGUE_TEXT_MAX} characters.`);
		}

		if (!REPORT_SLUG_PATTERN.test(slug) || slug.length > REPORT_CATALOGUE_TEXT_MAX) {
			throw new BadRequestException('slug must be lowercase words joined by single hyphens.');
		}

		for (const member of ['description', 'image', 'iconClass'] as const) {
			const value = input[member];
			const malformed = typeof value !== 'string' || value.length > REPORT_CATALOGUE_TEXT_MAX;

			if (value !== undefined && value !== null && malformed) {
				throw new BadRequestException(`${member} must be at most ${REPORT_CATALOGUE_TEXT_MAX} characters.`);
			}
		}

		// A live category, read through the category service so the soft-delete filter applies.
		await this.reportCategoryService.findOneByIdString(input.categoryId);

		if ((await this.countBy({ slug })) > 0) {
			throw new ConflictException(`REPORT_SLUG_TAKEN: a report with the slug "${slug}" already exists.`);
		}

		return await this.create({
			name,
			slug,
			description: input.description ?? undefined,
			image: input.image ?? undefined,
			iconClass: input.iconClass ?? undefined,
			categoryId: input.categoryId,
			showInMenu: false
		});
	}

	/**
	 * Retrieves all reports for the specified organization and tenant, including whether they should be shown in the menu.
	 *
	 * @param filter The filter containing organization ID and tenant ID for retrieving reports.
	 * @returns A promise that resolves to an object containing paginated report items and total count.
	 */
	public async findAllReports(filter?: any): Promise<IPagination<Report>> {
		// Builds its own query, so the check in the CRUD read methods never runs: assert the
		// sensitive-relation table on the client-supplied relations before anything is loaded.
		this.assertRelationsPermitted(filter);

		console.time(`ReportService.findAll took seconds`);
		// Extract organizationId and tenantId from filter
		const { organizationId } = filter;
		const tenantId = RequestContext.currentTenantId() || filter.tenantId;

		switch (this.ormType) {
			case MultiORMEnum.MikroORM: {
				const [items, total] = await this.mikroOrmRepository.findAndCount(
					{},
					{
						populate: [...(filter.relations ? filter.relations : []), 'reportOrganizations'] as any[]
					}
				);

				const reports = items.map((item: any) => {
					const s = this.serialize(item);
					const orgs = (s.reportOrganizations || []).filter(
						(ro: any) =>
							ro.organizationId === organizationId &&
							ro.tenantId === tenantId &&
							ro.isEnabled &&
							ro.isActive &&
							!ro.isArchived
					);
					s.showInMenu = !!orgs.length;
					delete s.reportOrganizations;
					return s;
				});

				console.timeEnd(`ReportService.findAll took seconds`);
				return { items: reports as Report[], total };
			}
			case MultiORMEnum.TypeORM:
			default: {
				// Fetch all reports and their associated organizations in a single query
				const qb = this.typeOrmRepository.createQueryBuilder('report');
				qb.setFindOptions({
					...(filter.relations ? { relations: parseFindOptionsRelations(filter.relations) } : {})
				});
				qb.leftJoinAndSelect(
					'report.reportOrganizations',
					'ro',
					'ro.organizationId = :organizationId AND ro.tenantId = :tenantId AND ro.isEnabled = :isEnabled AND ro.isActive = :isActive AND ro.isArchived = :isArchived',
					{
						organizationId,
						tenantId,
						isEnabled: true,
						isActive: true,
						isArchived: false
					}
				);

				// Execute the query
				const [items, total] = await qb.getManyAndCount();

				// Map over items and set 'showInMenu' property based on menu item existence
				const reports = items.map((item) => {
					item.showInMenu = !!item.reportOrganizations.length;
					delete item.reportOrganizations;
					return item;
				});

				console.timeEnd(`ReportService.findAll took seconds`);
				return { items: reports, total: total };
			}
		}
	}

	/**
	 * Retrieves report menu items based on the provided options.
	 *
	 * @param input The input containing the organization ID and tenant ID for filtering report menu items.
	 * @returns A promise that resolves to an array of report menu items.
	 */
	public async getMenuItems(input: GetReportMenuItemsInput): Promise<IReport[]> {
		const { organizationId } = input;
		const tenantId = RequestContext.currentTenantId() || input.tenantId;

		switch (this.ormType) {
			case MultiORMEnum.MikroORM: {
				const items = await this.mikroOrmRepository.find({
					reportOrganizations: {
						organizationId,
						tenantId,
						isEnabled: true,
						isActive: true,
						isArchived: false
					}
				} as any);
				return items.map((e) => this.serialize(e)) as IReport[];
			}
			case MultiORMEnum.TypeORM:
			default: {
				const qb = this.typeOrmRepository.createQueryBuilder('report');
				qb.innerJoin(
					'report.reportOrganizations',
					'ro',
					'ro.isEnabled = :isEnabled AND ro.isActive = :isActive AND ro.isArchived = :isArchived',
					{
						isEnabled: true,
						isActive: true,
						isArchived: false
					}
				);
				qb.andWhere('ro.organizationId = :organizationId', { organizationId });
				qb.andWhere('ro.tenantId = :tenantId', { tenantId });

				return await qb.getMany();
			}
		}
	}
}
