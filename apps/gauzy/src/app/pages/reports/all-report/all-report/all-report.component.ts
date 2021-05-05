import { Component, OnInit } from '@angular/core';
import {
	IGetReportCategory,
	IOrganization,
	IReport,
	IReportCategory,
	PermissionsEnum
} from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Store } from 'apps/gauzy/src/app/@core/services/store.service';
import { filter } from 'rxjs/operators';
import { chain } from 'underscore';
import { ReportService } from '../report.service';

@UntilDestroy()
@Component({
	selector: 'ga-all-report',
	templateUrl: './all-report.component.html',
	styleUrls: ['./all-report.component.scss']
})
export class AllReportComponent implements OnInit {
	PermissionsEnum = PermissionsEnum;
	organization: IOrganization;
	loading: boolean;
	reportCategories: IReportCategory[];

	constructor(private reportService: ReportService, private store: Store) {}

	ngOnInit(): void {
		this.store.selectedOrganization$
			.pipe(
				filter((organization: IOrganization) => !!organization),
				untilDestroyed(this)
			)
			.subscribe((organization) => {
				if (organization) {
					this.organization = organization;
					this.getReports();
				}
			});
	}

	updateShowInMenu(isEnabled: boolean, report): void {
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;
		this.reportService
			.updateReport({
				reportId: report.id,
				organizationId,
				tenantId,
				isEnabled
			})
			.then(() => {
				this.reportService.getReportMenuItems({
					organizationId,
					tenantId
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
