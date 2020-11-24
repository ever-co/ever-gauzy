import {
	GetReportMenuItemsInput,
	IGetReport,
	IPagination,
	UpdateReportMenuInput
} from '@gauzy/models';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { indexBy } from 'underscore';
import { CrudService } from '../core';
import { ReportOrganization } from './report-organization.entity';
import { Report } from './report.entity';

@Injectable()
export class ReportService extends CrudService<Report> {
	constructor(
		@InjectRepository(Report)
		reportRepository: Repository<Report>,
		@InjectRepository(ReportOrganization)
		private reportOrganizationRepository: Repository<ReportOrganization>
	) {
		super(reportRepository);
	}

	public async findAll(filter?: IGetReport): Promise<IPagination<Report>> {
		const { items, total } = await super.findAll(filter);

		const menuItems = await this.getMenuItems({
			organizationId: filter.organizationId
		});
		const orgMenuItems = indexBy(menuItems, 'id');

		const mapItems = items.map((item) => {
			if (orgMenuItems[item.id]) {
				item.showInMenu = true;
			} else {
				item.showInMenu = false;
			}
			return item;
		});
		return { items: mapItems, total };
	}

	public getMenuItems(filter: GetReportMenuItemsInput): Promise<Report[]> {
		return this.repository.find({
			relations: ['reportOrganizations'],
			join: {
				alias: 'reports',
				innerJoin: {
					reportOrganizations: 'reports.reportOrganizations'
				}
			},
			where: (qb) => {
				qb.where(
					'"reportOrganizations"."organizationId" = :organizationId',
					{ organizationId: filter.organizationId }
				);
				qb.andWhere('"reportOrganizations"."isEnabled" = :isEnabled', {
					isEnabled: true
				});
			}
		});
	}

	async updateReportMenu(
		input: UpdateReportMenuInput
	): Promise<ReportOrganization> {
		let reportOrganization = await this.reportOrganizationRepository.findOne(
			{
				where: {
					reportId: input.reportId
				}
			}
		);

		if (!reportOrganization) {
			reportOrganization = new ReportOrganization(input);
		} else {
			reportOrganization = new ReportOrganization(
				Object.assign(reportOrganization, input)
			);
		}

		this.reportOrganizationRepository.save(reportOrganization);
		return reportOrganization;
	}
}
