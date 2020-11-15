import { Component, OnInit } from '@angular/core';
import {
	IGetReportCategory,
	IOrganization,
	IReport,
	IReportCategory,
	ITimeLogFilters,
	PermissionsEnum
} from '@gauzy/models';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Store } from 'apps/gauzy/src/app/@core/services/store.service';
import * as moment from 'moment';
import { chain } from 'underscore';
import { ReportService } from '../report.server';

@UntilDestroy()
@Component({
	selector: 'ga-all-report',
	templateUrl: './all-report.component.html',
	styleUrls: ['./all-report.component.scss']
})
export class AllReportComponent implements OnInit {
	PermissionsEnum = PermissionsEnum;
	organization: IOrganization;

	logRequest: ITimeLogFilters = {
		startDate: moment().startOf('week').toDate(),
		endDate: moment().endOf('week').toDate()
	};
	loading: boolean;
	reportCategories: IReportCategory[];

	constructor(private reportService: ReportService, private store: Store) {}

	ngOnInit(): void {
		this.store.selectedOrganization$
			.pipe(untilDestroyed(this))
			.subscribe((organization) => {
				if (organization) {
					this.organization = organization;
					this.getReports();
				}
			});
	}

	updateShowInMenu(isEnabled: boolean, report): void {
		this.reportService
			.updateReport({
				reportId: report.id,
				organizationId: this.organization.id,
				isEnabled
			})
			.then(() => {
				this.reportService.getReportMenuItems({
					organizationId: this.organization.id
				});
			});
	}

	getReports() {
		const request: IGetReportCategory = {
			relations: ['category'],
			organizationId: this.organization.id
		};
		this.loading = true;
		this.reportService
			.getReports(request)
			.then((resp) => {
				this.reportCategories = chain(resp.items)
					.groupBy('categoryId')
					.map((reports: IReport[]) => {
						return {
							...reports[0].category,
							reports
						};
					})
					.value();
			})
			.finally(() => {
				this.loading = false;
			});
	}
}
