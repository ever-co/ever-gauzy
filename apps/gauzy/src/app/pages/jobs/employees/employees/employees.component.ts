import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
	IEmployeeJobsStatisticsResponse,
	IOrganization
} from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { distinctUntilChange } from '@gauzy/common-angular';
import { TranslateService } from '@ngx-translate/core';
import { AvatarComponent } from './../../../../@shared/components/avatar/avatar.component';
import { IPaginationBase, PaginationFilterBaseComponent } from './../../../../@shared/pagination/pagination-filter-base.component';
import { Ng2SmartTableComponent } from 'ng2-smart-table';
import { Subject } from 'rxjs';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { EmployeesService, Store, ToastrService } from './../../../../@core/services';
import { SmartTableToggleComponent } from './../../../../@shared/smart-table/smart-table-toggle/smart-table-toggle.component';
import { ServerDataSource } from './../../../../@core/utils/smart-table';
import { API_PREFIX } from './../../../../@core/constants';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-job-employees',
	templateUrl: './employees.component.html',
	styleUrls: ['./employees.component.scss']
})
export class EmployeesComponent extends PaginationFilterBaseComponent 
	implements OnInit, OnDestroy {

	loading: boolean = false;
	settingsSmartTable: any;

	employees$: Subject<any> = new Subject();
	smartTableSource: ServerDataSource;
	organization: IOrganization;

	jobEmployeesTable: Ng2SmartTableComponent;
	@ViewChild('jobEmployeesTable') set content(content: Ng2SmartTableComponent) {
		if (content) {
			this.jobEmployeesTable = content;
			this.onChangedSource();
		}
	}

	constructor(
		private readonly httpClient: HttpClient,
		private readonly store: Store,
		public readonly translateService: TranslateService,
		private readonly employeesService: EmployeesService,
		private readonly toastrService: ToastrService
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this._applyTranslationOnSmartTable();
		this._loadSmartTableSettings();
		this.employees$
			.pipe(
				debounceTime(100),
				tap(() => this._getEmployees()),
				untilDestroyed(this)
			)
			.subscribe();
		this.pagination$
			.pipe(
				debounceTime(100),
				distinctUntilChange(),
				tap(() => this.employees$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
		this.store.selectedOrganization$
			.pipe(
				distinctUntilChange(),
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => this.organization = organization),
				tap(() => this.employees$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	private _getEmployees() {
		if (!this.organization) {
			return;
		}
		try {
			this.loading = true;

			const { tenantId } = this.store.user;
			const { id: organizationId } = this.organization;

			this.smartTableSource = new ServerDataSource(this.httpClient, {
				endPoint: `${API_PREFIX}/employee/job-statistics`,
				relations: ['user'],
				where: {
					tenantId,
					organizationId,
					isActive: true,
					...this.filters.where
				},
				finalize: () => {
					this.setPagination({
						...this.getPagination(),
						totalItems: this.smartTableSource.count()
					});
					this.loading = false;
				}
			});

			const { activePage, itemsPerPage } = this.getPagination();
			this.smartTableSource.setPaging(activePage, itemsPerPage, false);
		} catch (error) {
			this.toastrService.danger(error);
		}
	}

	private _loadSmartTableSettings() {
		const pagination: IPaginationBase = this.getPagination();
		this.settingsSmartTable = {
			editable: false,
			actions: false,
			hideSubHeader: true,
			noDataMessage: this.getTranslation('SM_TABLE.NO_DATA'),
			pager: {
				display: false,
				perPage: pagination ? pagination.itemsPerPage : 10
			},
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
							src: row.user ? row.user.imageUrl : null,
							id: row.id
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

	private _applyTranslationOnSmartTable() {
		this.translateService.onLangChange
			.pipe(
				tap(() => this._loadSmartTableSettings()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngOnDestroy(): void {}
}
