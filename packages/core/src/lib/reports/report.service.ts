import { Injectable, Logger } from '@nestjs/common';
import { GetReportMenuItemsInput, IPagination, IReport } from '@gauzy/contracts';
import { CrudService } from '../core/crud';
import { MultiORMEnum } from '../core/utils';
import { RequestContext } from './../core/context';
import { Report } from './report.entity';
import { MikroOrmReportRepository } from './repository/mikro-orm-report.repository';
import { TypeOrmReportRepository } from './repository/type-orm-report.repository';

@Injectable()
export class ReportService extends CrudService<Report> {
	private readonly logger = new Logger(ReportService.name);

	constructor(
		readonly typeOrmReportRepository: TypeOrmReportRepository,
		readonly mikroOrmReportRepository: MikroOrmReportRepository
	) {
		super(typeOrmReportRepository, mikroOrmReportRepository);
	}

	/**
	 * Retrieves all reports for the specified organization and tenant, including whether they should be shown in the menu.
	 *
	 * @param filter The filter containing organization ID and tenant ID for retrieving reports.
	 * @returns A promise that resolves to an object containing paginated report items and total count.
	 */
	public async findAllReports(filter?: any): Promise<IPagination<Report>> {
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
					...(filter.relations ? { relations: filter.relations } : {})
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
