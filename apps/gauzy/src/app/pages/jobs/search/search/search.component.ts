import { HttpClient } from '@angular/common/http';
import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import {
	IApplyJobPostInput,
	IEmployeeJobPost,
	IGetEmployeeJobPostFilters,
	IJobMatchings,
	ISelectedEmployee,
	IVisibilityJobPostInput,
	JobPostSourceEnum,
	JobPostStatusEnum,
	JobPostTypeEnum
} from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { JobService } from 'apps/gauzy/src/app/@core/services/job.service';
import { Store } from 'apps/gauzy/src/app/@core/services/store.service';
import { ToastrService } from 'apps/gauzy/src/app/@core/services/toastr.service';
import { AvatarComponent } from 'apps/gauzy/src/app/@shared/components/avatar/avatar.component';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';
import { Ng2SmartTableComponent, ServerDataSource } from 'ng2-smart-table';
import {
	Nl2BrPipe,
	TruncatePipe
} from 'apps/gauzy/src/app/@shared/pipes/text.pipe';
import { StatusBadgeComponent } from 'apps/gauzy/src/app/@shared/status-badge/status-badge.component';
import * as moment from 'moment';
import { Subject, Subscription, timer } from 'rxjs';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { ProposalTemplateService } from '../../proposal-template/proposal-template.service';
import { API_PREFIX } from 'apps/gauzy/src/app/@core/constants/app.constants';

@UntilDestroy()
@Component({
	selector: 'ga-search',
	templateUrl: './search.component.html',
	styleUrls: ['./search.component.scss']
})
export class SearchComponent
	extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	loading = false;
	autoRefresh = false;
	settingsSmartTable: any = {
		editable: false,
		actions: {
			columnTitle: this.getTranslation('JOBS.ACTIONS'),
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
		jobStatus: null,
		budget: []
	};

	updateJobs$: Subject<any> = new Subject();
	selectedEmployee: ISelectedEmployee;
	smartTableSource: ServerDataSource;
	autoRefreshTimer: Subscription;

	jobSearchTable: Ng2SmartTableComponent;
	@ViewChild('jobSearchTable') set content(content: Ng2SmartTableComponent) {
		if (content) {
			this.jobSearchTable = content;
			this.onChangedSource();
		}
	}

	constructor(
		private http: HttpClient,
		private store: Store,
		public translateService: TranslateService,
		public proposalTemplateService: ProposalTemplateService,
		private toastrService: ToastrService,
		private jobService: JobService,
		private nl2BrPipe: Nl2BrPipe,
		private truncatePipe: TruncatePipe
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this._applyTranslationOnSmartTable();
		this.updateJobs$
			.pipe(untilDestroyed(this), debounceTime(500))
			.subscribe(() => {
				this.loadSmartTable();
			});
		this.store.selectedEmployee$
			.pipe(
				filter((employee) => !!employee),
				untilDestroyed(this)
			)
			.subscribe((employee) => {
				if (employee && employee.id) {
					this.selectedEmployee = employee;
					this.jobRequest.employeeIds = [employee.id];
				} else {
					this.selectedEmployee = null;
					this.jobRequest.employeeIds = [];
				}
				this.updateJobs$.next();
			});
	}

	redirectToView() {}

	applyFilter() {
		this.updateJobs$.next();
	}

	getEmployeeDefaultProposalTemplate(job: IJobMatchings) {
		console.log({ job });
		return this.proposalTemplateService
			.getAll({
				where: {
					employeeId: job.employeeId,
					isDefault: true
				}
			})
			.then(async (resp) => {
				if (resp.items.length > 0) {
					return resp.items[0];
				}
				return null;
			});
	}

	copyTextToClipboard(text) {
		if (!navigator.clipboard) {
			const textArea = document.createElement('textarea');
			textArea.value = text;

			// Avoid scrolling to bottom
			textArea.style.width = '0';
			textArea.style.height = '0';
			textArea.style.top = '0';
			textArea.style.left = '0';
			textArea.style.position = 'fixed';

			document.body.appendChild(textArea);
			textArea.focus();
			textArea.select();

			try {
				const successful = document.execCommand('copy');
				const msg = successful ? 'successful' : 'unsuccessful';
				console.log('Fallback: Copying text command was ' + msg);
			} catch (err) {
				console.error('Fallback: Oops, unable to copy', err);
			}
			return;
		}
		return navigator.clipboard.writeText(text).then(
			() => {
				console.log('Async: Copying to clipboard was successful!');
			},
			(err) => {
				console.error('Async: Could not copy text: ', err);
			}
		);
	}

	setAutoRefresh(value) {
		if (value) {
			this.autoRefreshTimer = timer(0, 60000)
				.pipe(untilDestroyed(this))
				.subscribe(() => {
					this.updateJobs$.next();
				});
		} else {
			if (this.autoRefreshTimer) {
				this.autoRefreshTimer.unsubscribe();
			}
		}
	}

	onCustom($event) {
		switch ($event.action) {
			case 'view':
				if ($event.data.jobPost) {
					window.open($event.data.jobPost.url, '_blank');
				}
				break;

			case 'apply':
				const applyRequest: IApplyJobPostInput = {
					applied: true,
					employeeId: $event.data.employeeId,
					providerCode: $event.data.jobPost.providerCode,
					providerJobId: $event.data.jobPost.providerJobId
				};
				this.jobService.applyJob(applyRequest).then(async (resp) => {
					this.toastrService.success('TOASTR.MESSAGE.JOB_APPLIED');
					this.smartTableSource.refresh();

					if (resp.isRedirectRequired) {
						const proposalTemplate = await this.getEmployeeDefaultProposalTemplate(
							$event.data
						);
						if (proposalTemplate) {
							await this.copyTextToClipboard(
								proposalTemplate.content
							);
						}
						window.open($event.data.jobPost.url, '_blank');
					}
				});
				break;

			case 'hide':
				const hideRequest: IVisibilityJobPostInput = {
					hide: true,
					employeeId: $event.data.employeeId,
					providerCode: $event.data.jobPost.providerCode,
					providerJobId: $event.data.jobPost.providerJobId
				};
				this.jobService.hideJob(hideRequest).then(() => {
					this.toastrService.success('TOASTR.MESSAGE.JOB_HIDDEN');
					this.smartTableSource.refresh();
				});
				break;

			default:
				break;
		}
	}

	public getInstance(): ServerDataSource {
		return new ServerDataSource(this.http, {
			endPoint: `${API_PREFIX}/employee-job`,
			sortFieldKey: 'orderBy',
			sortDirKey: 'order',
			filterFieldKey: 'filters',
			totalKey: 'total',
			dataKey: 'items',
			pagerPageKey: 'page',
			pagerLimitKey: 'limit'
		});
	}

	loadSmartTable() {
		//create ServerDataSource singleton instance
		if (!this.smartTableSource) {
			this.smartTableSource = this.getInstance();
		}
		this.smartTableSource.setSort(
			[{ field: 'status', direction: 'asc' }],
			false
		);
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
								sort: false,
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
					sort: false,
					valuePrepareFunction: (cell, row: IEmployeeJobPost) => {
						return `${row.jobPost.title.slice(0, 150)}`;
					}
				},
				description: {
					title: this.getTranslation('JOBS.DESCRIPTION'),
					type: 'html',
					width: '30%',
					filter: false,
					sort: false,
					valuePrepareFunction: (cell, row: IEmployeeJobPost) => {
						let value = this.nl2BrPipe.transform(
							row.jobPost.description
						);
						value = this.truncatePipe.transform(value, 500);
						return value;
					}
				},
				jobDateCreated: {
					title: this.getTranslation('JOBS.CREATED_DATE'),
					type: 'text',
					width: '15%',
					filter: false,
					valuePrepareFunction: (cell, row: IEmployeeJobPost) => {
						return moment(row.jobPost.jobDateCreated).format('LLL');
					}
				},
				jobStatus: {
					title: this.getTranslation('JOBS.STATUS'),
					width: '15%',
					filter: false,
					type: 'custom',
					sort: false,
					renderComponent: StatusBadgeComponent,
					valuePrepareFunction: (cell, row: IEmployeeJobPost) => {
						let badgeClass;
						if (
							row.jobPost.jobStatus.toLowerCase() ===
							JobPostStatusEnum.CLOSED.toLowerCase()
						) {
							badgeClass = 'danger';
							cell = this.getTranslation('JOBS.STATUS_CLOSED');
						} else if (
							row.jobPost.jobStatus.toLowerCase() ===
							JobPostStatusEnum.OPEN.toLowerCase()
						) {
							badgeClass = 'success';
							cell = this.getTranslation('JOBS.STATUS_OPEN');
						} else if (
							row.jobPost.jobStatus.toLowerCase() ===
							JobPostStatusEnum.APPLIED.toLowerCase()
						) {
							badgeClass = 'warning';
							cell = this.getTranslation('JOBS.STATUS_APPLIED');
						} else {
							badgeClass = 'default';
							cell = row.jobPost.jobStatus;
						}

						return {
							text: cell,
							class: badgeClass
						};
					}
				}
			}
		};
	}

	private _applyTranslationOnSmartTable() {
		this.translateService.onLangChange
			.pipe(untilDestroyed(this))
			.subscribe(() => {
				this.updateJobs$.next();
			});
	}

	/*
	 * Table on changed source event
	 */
	onChangedSource() {
		this.jobSearchTable.source.onChangedSource
			.pipe(
				untilDestroyed(this),
				tap(() => this.clearItem())
			)
			.subscribe();
	}

	/*
	 * Hide all jobs
	 */
	hideAll() {
		const request: IVisibilityJobPostInput = {
			hide: true,
			...(this.selectedEmployee && this.selectedEmployee.id
				? { employeeId: this.selectedEmployee.id }
				: {})
		};
		this.jobService.hideJob(request).then(() => {
			this.toastrService.success('TOASTR.MESSAGE.JOB_HIDDEN');
			this.smartTableSource.refresh();
		});
	}

	/*
	 * Clear selected item
	 */
	clearItem() {
		this.deselectAll();
	}
	/*
	 * Deselect all table rows
	 */
	deselectAll() {
		if (this.jobSearchTable && this.jobSearchTable.grid) {
			this.jobSearchTable.grid.dataSet['willSelect'] = 'false';
			this.jobSearchTable.grid.dataSet.deselectAll();
		}
	}

	ngOnDestroy(): void {}
}
