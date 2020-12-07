import { Component, OnDestroy, OnInit } from '@angular/core';
import { IEmployeeJobsStatisticsResponse, IOrganization } from '@gauzy/models';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { Store } from 'apps/gauzy/src/app/@core/services/store.service';
import { AvatarComponent } from 'apps/gauzy/src/app/@shared/components/avatar/avatar.component';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';
import { LocalDataSource } from 'ng2-smart-table';
import { Subject } from 'rxjs';
import { debounceTime, filter } from 'rxjs/operators';
import { EmployeesService } from 'apps/gauzy/src/app/@core/services';
import { SmartTableToggleComponent } from 'apps/gauzy/src/app/@shared/smart-table/smart-table-toggle/smart-table-toggle.component';

@UntilDestroy()
@Component({
	selector: 'ga-employees',
	templateUrl: './employees.component.html',
	styleUrls: ['./employees.component.scss']
})
export class EmployeesComponent
	extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	loading: boolean;

	settingsSmartTable: any = {
		editable: false,
		actions: false
	};

	updateJobs$: Subject<any> = new Subject();
	smartTableSource: LocalDataSource = new LocalDataSource();
	organization: IOrganization;

	constructor(
		private store: Store,
		public translateService: TranslateService,
		private employeesService: EmployeesService
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this.updateJobs$
			.pipe(untilDestroyed(this), debounceTime(500))
			.subscribe(() => {
				this.getEmployees();
			});

		this.store.selectedOrganization$
			.pipe(
				filter((organization) => !!organization),
				untilDestroyed(this)
			)
			.subscribe((organization) => {
				if (organization && organization.id) {
					this.organization = organization;
				} else {
					this.organization = null;
				}
				this.loadSmartTable();
				this.updateJobs$.next();
			});
	}

	getEmployees() {
		this.loading = true;
		this.employeesService
			.getEmployeeJobsStatistics({
				relations: ['user'],
				where: {
					organizationId: this.organization.id,
					isActive: true
				}
			})
			.then((data) => {
				this.smartTableSource.load(data.items);
				this.loading = false;
			});
	}

	loadSmartTable() {
		this.settingsSmartTable = {
			...this.settingsSmartTable,
			columns: {
				employeeId: {
					title: this.getTranslation('JOB_EMPLOYEE.EMPLOYEE'),
					filter: false,
					width: '40%',
					type: 'custom',
					sort: false,
					renderComponent: AvatarComponent,
					valuePrepareFunction: (
						cell,
						row: IEmployeeJobsStatisticsResponse
					) => {
						return {
							name: row.user ? row.user.name : null,
							src: row.user ? row.user.imageUrl : null
						};
					}
				},
				availableJobs: {
					title: this.getTranslation('JOB_EMPLOYEE.AVAILABLE_JOBS'),
					type: 'text',
					width: '20%',
					filter: false,
					sort: false,
					valuePrepareFunction: (
						cell,
						row: IEmployeeJobsStatisticsResponse
					) => {
						return row.availableJobs || 0;
					}
				},
				appliedJobs: {
					title: this.getTranslation('JOB_EMPLOYEE.APPLIED_JOBS'),
					type: 'html',
					width: '20%',
					filter: false,
					sort: false,
					valuePrepareFunction: (
						cell,
						row: IEmployeeJobsStatisticsResponse
					) => {
						return row.appliedJobs || 0;
					}
				},
				isJobSearchActive: {
					title: this.getTranslation(
						'JOB_EMPLOYEE.JOB_SEARCH_STATUS'
					),
					type: 'custom',
					width: '20%',
					filter: false,
					renderComponent: SmartTableToggleComponent,
					valuePrepareFunction: (
						cell,
						row: IEmployeeJobsStatisticsResponse
					) => {
						return {
							checked: row.isJobSearchActive,
							onChange: (toggleValue) =>
								this.updateJobSearchAvailability(
									row,
									toggleValue
								)
						};
					}
				}
			}
		};
	}

	updateJobSearchAvailability(employee, toggleValue): void {
		this.employeesService.updateJobSearchStatus(employee.id, toggleValue);
	}

	ngOnDestroy(): void {}
}
