import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import {
	IEmployeeJobsStatisticsResponse,
	IOrganization
} from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { Store } from './../../../../@core/services/store.service';
import { AvatarComponent } from './../../../../@shared/components/avatar/avatar.component';
import { TranslationBaseComponent } from './../../../../@shared/language-base/translation-base.component';
import { LocalDataSource, Ng2SmartTableComponent } from 'ng2-smart-table';
import { Subject } from 'rxjs';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { EmployeesService } from './../../../../@core/services';
import { SmartTableToggleComponent } from './../../../../@shared/smart-table/smart-table-toggle/smart-table-toggle.component';

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
		actions: false,
		hideSubHeader: true
	};

	updateJobs$: Subject<any> = new Subject();
	smartTableSource: LocalDataSource = new LocalDataSource();
	organization: IOrganization;

	jobEmployeesTable: Ng2SmartTableComponent;
	@ViewChild('jobEmployeesTable') set content(content: Ng2SmartTableComponent) {
		if (content) {
			this.jobEmployeesTable = content;
			this.onChangedSource();
		}
	}

	constructor(
		private store: Store,
		public translateService: TranslateService,
		private employeesService: EmployeesService
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this.updateJobs$
			.pipe(
				untilDestroyed(this), 
				debounceTime(500)
			)
			.subscribe(() => {
				this.getEmployees();
			});
		this.store.selectedOrganization$
			.pipe(
				filter((organization) => !!organization),
				tap((organization) => this.organization = organization),
				untilDestroyed(this)
			)
			.subscribe(() => {
				this.loadSmartTable();
				this.updateJobs$.next(true);
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
			}).finally(() => {
				this.loading = false;
			});
	}

	loadSmartTable() {
		this.settingsSmartTable = {
			...this.settingsSmartTable,
			columns: {
				employeeId: {
					title: this.getTranslation('JOB_EMPLOYEE.EMPLOYEE'),
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

	/*
	 * Table on changed source event
	 */
	onChangedSource() {
		this.jobEmployeesTable.source.onChangedSource
			.pipe(
				untilDestroyed(this),
				tap(() => this.deselectAll())
			)
			.subscribe();
	}

	/*
	 * Deselect all table rows
	 */
	deselectAll() {
		if (this.jobEmployeesTable && this.jobEmployeesTable.grid) {
			this.jobEmployeesTable.grid.dataSet['willSelect'] = 'false';
			this.jobEmployeesTable.grid.dataSet.deselectAll();
		}
	}

	ngOnDestroy(): void {}
}
