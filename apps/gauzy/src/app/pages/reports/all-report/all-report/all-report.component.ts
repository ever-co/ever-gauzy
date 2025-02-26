import { Component, OnInit } from '@angular/core';
import { IGetReportCategory, IOrganization, IReport, IReportCategory, PermissionsEnum } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { filter, tap } from 'rxjs/operators';
import { chain } from 'underscore';
import { Store } from '@gauzy/ui-core/core';
import { ReportService } from '../report.service';

@UntilDestroy()
@Component({
    selector: 'ga-all-report',
    templateUrl: './all-report.component.html',
    styleUrls: ['./all-report.component.scss'],
    standalone: false
})
export class AllReportComponent implements OnInit {
	PermissionsEnum = PermissionsEnum;
	public organization: IOrganization;
	public loading: boolean;
	public reportCategories: IReportCategory[];

	constructor(private readonly reportService: ReportService, private readonly store: Store) {}

	ngOnInit(): void {
		this.store.selectedOrganization$
			.pipe(
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => (this.organization = organization)),
				tap(() => this.getReports()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Updates the 'show in menu' status of a report.
	 *
	 * @param isEnabled Indicates whether the report should be shown in the menu.
	 * @param report The report to update.
	 */
	async updateShowInMenu(isEnabled: boolean, report): Promise<void> {
		try {
			const { id: organizationId, tenantId } = this.organization;

			await this.reportService.updateReport({
				reportId: report.id,
				organizationId,
				tenantId,
				isEnabled
			});

			await this.reportService.getReportMenuItems({
				organizationId,
				tenantId
			});
		} catch (error) {
			console.error(`Error occurred while updating 'show in menu' status: ${error.message}`);
		}
	}

	/**
	 * Retrieves all reports for the current organization.
	 *
	 * @returns A promise that resolves when reports are successfully retrieved.
	 */
	async getReports() {
		if (!this.organization) {
			return false;
		}
		try {
			this.loading = true;

			const { id: organizationId, tenantId } = this.organization;
			const request: IGetReportCategory = {
				organizationId,
				tenantId,
				relations: ['category']
			};

			const { items = [] } = await this.reportService.getReports(request);

			const categories = chain(items).groupBy('categoryId');
			this.reportCategories = categories
				.map((reports: IReport[]) => ({
					...reports[0].category,
					reports
				}))
				.value();
		} catch (error) {
			console.log('Error while retrieving report with category', error);
		} finally {
			this.loading = false;
		}
	}
}
