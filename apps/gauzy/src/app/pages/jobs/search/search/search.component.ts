import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import {
	IEmployeeJobPost,
	IGetEmployeeJobPostFilters,
	JobPostSourceEnum,
	JobPostStatusEnum,
	JobPostTypeEnum
} from '@gauzy/models';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { JobService } from 'apps/gauzy/src/app/@core/services/job.service';
import { Store } from 'apps/gauzy/src/app/@core/services/store.service';
import { ToastrService } from 'apps/gauzy/src/app/@core/services/toastr.service';
import { AvatarComponent } from 'apps/gauzy/src/app/@shared/components/avatar/avatar.component';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';
import { StatusBadgeComponent } from 'apps/gauzy/src/app/@shared/status-badge/status-badge.component';
import { SelectedEmployee } from 'apps/gauzy/src/app/@theme/components/header/selectors/employee/employee.component';
import * as moment from 'moment';
import { ServerDataSource } from 'ng2-smart-table';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';

@UntilDestroy()
@Component({
	selector: 'gauzy-search',
	templateUrl: './search.component.html',
	styleUrls: ['./search.component.scss']
})
export class SearchComponent
	extends TranslationBaseComponent
	implements OnInit {
	loading = false;
	settingsSmartTable: any = {
		editable: false,
		// pager: {
		// 	display: true,
		// 	perPage: 10
		// },
		actions: {
			columnTitle: 'Actions',
			add: false,
			edit: false,
			delete: false,
			position: 'right',
			mode: 'external',
			custom: [
				{
					name: 'view',
					title: `<span class="btn btn-primary">${this.getTranslation(
						'JOBS.VIEW'
					)}</span>`
				},
				{
					name: 'apply',
					title: `<span class="btn btn-success">${this.getTranslation(
						'JOBS.APPLY'
					)}</span>`
				},
				{
					name: 'hide',
					title: `<span class="btn btn-danger">${this.getTranslation(
						'JOBS.HIDE'
					)}</span>`
				}
			]
		}
	};
	isOpenAdvancedFilter = false;
	jobs: IEmployeeJobPost[] = [];

	JobPostSourceEnum = JobPostSourceEnum;
	JobPostTypeEnum = JobPostTypeEnum;
	JobPostStatusEnum = JobPostStatusEnum;

	jobRequest: IGetEmployeeJobPostFilters = {
		employeeIds: [],
		jobSource: [],
		jobType: [],
		jobStatus: [JobPostStatusEnum.OPEN],
		budget: null
	};

	updateJobs$: Subject<any> = new Subject();
	selectedEmployee: SelectedEmployee;

	smartTableSource = new ServerDataSource(this.http, {
		endPoint: '/api/employee-job',
		sortFieldKey: 'orderBy',
		sortDirKey: 'order',
		filterFieldKey: 'filters',
		totalKey: 'total',
		dataKey: 'items',
		pagerPageKey: 'page',
		pagerLimitKey: 'limit'
	});

	constructor(
		private http: HttpClient,
		private store: Store,
		public translateService: TranslateService,
		public toastrService: ToastrService,
		public jobService: JobService
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this.updateJobs$
			.pipe(untilDestroyed(this), debounceTime(500))
			.subscribe(() => {
				// this.smartTableSource.refresh();
				this.smartTableSource.setFilter(
					[
						{
							field: 'custom',
							search: JSON.stringify(this.jobRequest)
						}
					],
					true,
					false
				);
				this.loadSmartTable();
				this._applyTranslationOnSmartTable();
			});

		this.store.selectedEmployee$
			.pipe(untilDestroyed(this))
			.subscribe((employee) => {
				setTimeout(() => {
					if (employee && employee.id) {
						this.selectedEmployee = employee;
						this.jobRequest.employeeIds = [employee.id];
					} else {
						this.selectedEmployee = null;
						this.jobRequest.employeeIds = [];
					}
					this.updateJobs$.next();
				});
			});

		this.updateJobs$.next();
	}

	redirectToView() {}

	applyFilter() {
		this.updateJobs$.next();
	}

	onCustom($event) {
		switch ($event.action) {
			case 'view':
				if ($event.data.jobPost) {
					window.open($event.data.jobPost.url, '_blank');
				}
				break;

			case 'apply':
				this.jobService.applyJob($event.data).then((resp) => {
					if (resp.isRedirectRequired) {
						window.open($event.data.jobPost.url, '_blank');
					} else {
						this.toastrService.success('Job applied successfully');
						this.smartTableSource.refresh();
					}
				});
				break;

			case 'hide':
				this.jobService.hideJob($event.data);
				this.smartTableSource.refresh();
				break;

			default:
				break;
		}
	}

	loadSmartTable() {
		this.settingsSmartTable = {
			...this.settingsSmartTable,
			columns: {
				...(!this.selectedEmployee
					? {
							employeeIds: {
								title: this.getTranslation('JOBS.EMPLOYEE'),

								filter: false,
								width: '15%',
								type: 'custom',
								renderComponent: AvatarComponent,
								valuePrepareFunction: (
									cell,
									row: IEmployeeJobPost
								) => {
									return {
										name:
											row.employee && row.employee.user
												? row.employee.user.name
												: null,
										src:
											row.employee && row.employee.user
												? row.employee.user.imageUrl
												: null
									};
								}
							}
					  }
					: {}),
				title: {
					title: this.getTranslation('JOBS.TITLE'),
					type: 'text',
					width: '20%',
					filter: false,
					valuePrepareFunction: (cell, row: IEmployeeJobPost) => {
						return `${row.jobPost.title.slice(0, 150)}`;
					}
				},
				description: {
					title: this.getTranslation('JOBS.DESCRIPTION'),
					type: 'text',
					width: '30%',
					filter: false,
					valuePrepareFunction: (cell, row: IEmployeeJobPost) => {
						return row.jobPost.description;
					}
				},
				jobDateCreated: {
					title: this.getTranslation('JOBS.CREATED_DATE'),
					type: 'text',
					width: '15%',
					filter: false,
					valuePrepareFunction: (cell, row: IEmployeeJobPost) => {
						return moment(row.jobPost.jobDateCreated).format('LL');
					}
				},
				jobStatus: {
					title: this.getTranslation('JOBS.STATUS'),
					width: '15%',
					filter: false,
					type: 'custom',
					renderComponent: StatusBadgeComponent,
					valuePrepareFunction: (cell, row: IEmployeeJobPost) => {
						let badgeClass;
						if (
							row.jobPost.jobStatus === JobPostStatusEnum.CLOSED
						) {
							badgeClass = 'danger';
							cell = this.getTranslation('JOBS.STATUS_CLOSED');
						} else if (
							row.jobPost.jobStatus === JobPostStatusEnum.OPEN
						) {
							badgeClass = 'success';
							cell = this.getTranslation('JOBS.STATUS_OPEN');
						} else if (
							row.jobPost.jobStatus === JobPostStatusEnum.APPLIED
						) {
							badgeClass = 'warning';
							cell = this.getTranslation('JOBS.STATUS_APPLIED');
						} else {
							badgeClass = 'default';
							cell = row.jobPost.jobStatus;
						}

						// return `<span class="badge badge-${badgeClass}">${cell}</span>`;

						return {
							text: cell,
							class: badgeClass
						};
					}
				}
			}
		};
	}

	_applyTranslationOnSmartTable() {
		this.translateService.onLangChange.subscribe(() => {
			this.loadSmartTable();
		});
	}
}
