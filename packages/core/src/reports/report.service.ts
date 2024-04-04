import {
	GetReportMenuItemsInput,
	IOrganization,
	IPagination,
	IReport,
	UpdateReportMenuInput,
} from '@gauzy/contracts';
import {
	Injectable,
	InternalServerErrorException,
	Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { indexBy } from 'underscore';
import { CrudService } from '../core/crud';
import { RequestContext } from './../core/context';
import { ReportOrganization } from './report-organization.entity';
import { Report } from './report.entity';
import { TypeOrmReportRepository } from './repository/type-orm-report.repository';
import { MikroOrmReportRepository } from './repository/mikro-orm-report.repository';
import { TypeOrmReportOrganizationRepository } from './repository/type-orm-report-organization.repository';

@Injectable()
export class ReportService extends CrudService<Report> {

	private readonly logger = new Logger(ReportService.name);

	constructor(
		@InjectRepository(Report)
		typeOrmReportRepository: TypeOrmReportRepository,

		mikroOrmReportRepository: MikroOrmReportRepository,

		@InjectRepository(ReportOrganization)
		readonly typeOrmReportOrganizationRepository: TypeOrmReportOrganizationRepository
	) {
		super(typeOrmReportRepository, mikroOrmReportRepository);
	}

	public async findAll(filter?: any): Promise<IPagination<Report>> {
		const start = new Date();

		const { items, total } = await super.findAll(filter);
		const menuItems = await this.getMenuItems(filter);

		const orgMenuItems = indexBy(menuItems, 'id');

		const mapItems = items.map((item) => {
			if (orgMenuItems[item.id]) {
				item.showInMenu = true;
			} else {
				item.showInMenu = false;
			}
			return item;
		});

		const end = new Date();
		const time = (end.getTime() - start.getTime()) / 1000;

		this.logger.log(`ReportService.findAll took ${time} seconds`);
		console.log(`ReportService.findAll took ${time} seconds`);

		return { items: mapItems, total };
	}

	/**
	 * Get reports menus
	 *
	 * @param options
	 * @returns
	 */
	public async getMenuItems(
		options: GetReportMenuItemsInput
	): Promise<IReport[]> {
		const { organizationId } = options;
		const tenantId = RequestContext.currentTenantId() || options.tenantId;

		return await this.typeOrmRepository.find({
			join: {
				alias: this.tableName,
				innerJoin: {
					reportOrganizations: `${this.tableName}.reportOrganizations`,
				}
			},
			where: {
				reportOrganizations: {
					organizationId,
					tenantId,
					isEnabled: true
				}
			}
		});
	}

	async updateReportMenu(
		input: UpdateReportMenuInput
	): Promise<ReportOrganization> {
		let reportOrganization =
			await this.typeOrmReportOrganizationRepository.findOne({
				where: {
					reportId: input.reportId,
				},
			});

		if (!reportOrganization) {
			reportOrganization = new ReportOrganization(input);
		} else {
			reportOrganization = new ReportOrganization(
				Object.assign(reportOrganization, input)
			);
		}

		this.typeOrmReportOrganizationRepository.save(reportOrganization);
		return reportOrganization;
	}

	/**
	 * Bulk create organization default reports menu.
	 *
	 * @param input - The organization input data.
	 * @returns A promise that resolves to an array of created ReportOrganization instances.
	 */
	async bulkCreateOrganizationReport(input: IOrganization): Promise<ReportOrganization[]> {
		try {
			const { id: organizationId, tenantId } = input;

			// Fetch reports from the database
			const reports: IReport[] = await super.find(); // Replace 'super' with your appropriate superclass or service

			// Create ReportOrganization instances based on fetched reports
			const reportOrganizations: ReportOrganization[] = reports.map((report: IReport) =>
				new ReportOrganization({
					report,
					organizationId,
					tenantId
				})
			);

			// Save the created ReportOrganization instances to the database
			await this.typeOrmReportOrganizationRepository.save(reportOrganizations);

			// Return the array of created ReportOrganization instances
			return reportOrganizations;
		} catch (error) {
			// Throw InternalServerErrorException if an error occurs
			throw new InternalServerErrorException(error);
		}
	}
}
