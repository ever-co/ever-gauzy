
import {
	Component,
	OnDestroy,
	OnInit,
	AfterViewInit
} from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, combineLatest, Subject, Subscription, timer } from 'rxjs';
import { debounceTime, filter, tap } from 'rxjs/operators';
import * as moment from 'moment';
import {
	IApplyJobPostInput,
	IEmployeeJobPost,
	IGetEmployeeJobPostFilters,
	IJobMatchings,
	IOrganization,
	ISelectedEmployee,
	IVisibilityJobPostInput,
	JobPostSourceEnum,
	JobPostStatusEnum,
	JobPostTypeEnum,
	JobSearchTabsEnum,
	PermissionsEnum
} from '@gauzy/contracts';
import { distinctUntilChange } from '@gauzy/common-angular';
import { NbTabComponent } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { EmployeeLinksComponent } from './../../../../@shared/table-components';
import { IPaginationBase, PaginationFilterBaseComponent } from '../../../../@shared/pagination/pagination-filter-base.component';
import { JobService, Store, ToastrService } from './../../../../@core/services';
import { Nl2BrPipe, TruncatePipe } from './../../../../@shared/pipes';
import { StatusBadgeComponent } from './../../../../@shared/status-badge';
import { TranslateService } from '@ngx-translate/core';
import { API_PREFIX } from './../../../../@core/constants';
import { AtLeastOneFieldValidator } from './../../../../@core/validators';
import { ServerDataSource } from './../../../../@core/utils/smart-table';
import { ProposalTemplateService } from '../../proposal-template/proposal-template.service';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-job-search',
	templateUrl: './search.component.html',
	styleUrls: ['./search.component.scss']
})
export class SearchComponent extends PaginationFilterBaseComponent
	implements OnInit, OnDestroy, AfterViewInit {

	loading: boolean = false;
	autoRefresh: boolean = false;
	settingsSmartTable: any;
	isOpenAdvancedFilter: boolean = false;
	jobs: IEmployeeJobPost[] = [];

	JobPostSourceEnum = JobPostSourceEnum;
	JobPostTypeEnum = JobPostTypeEnum;
	JobPostStatusEnum = JobPostStatusEnum;
	PermissionsEnum = PermissionsEnum;

	jobRequest: IGetEmployeeJobPostFilters = {
		employeeIds: [],
		jobSource: [],
		jobType: [],
		jobStatus: null,
		budget: []
	};

	jobs$: Subject<any> = this.subject$;
	smartTableSource: ServerDataSource;
	autoRefreshTimer: Subscription;

	selectedJob = {
		data: null,
		isSelected: false
	};

	jobSearchTabsEnum = JobSearchTabsEnum;
	nbTab$: Subject<string> = new BehaviorSubject(JobSearchTabsEnum.ACTIONS);

	public organization: IOrganization;
	public selectedEmployeeId: ISelectedEmployee['id'];

	/*
	* Search Tab Form
	*/
	public form: FormGroup = SearchComponent.buildForm(this.fb);
	static buildForm(fb: FormBuilder): FormGroup {
		return fb.group({
			search: [],
			jobSource: [],
			jobType: [],
			jobStatus: [],
			budget: []
		}, {
			validators: [AtLeastOneFieldValidator]
		});
	}

	constructor(
		private readonly fb: FormBuilder,
		private readonly http: HttpClient,
		private readonly store: Store,
		public readonly translateService: TranslateService,
		public readonly proposalTemplateService: ProposalTemplateService,
		private readonly toastrService: ToastrService,
		private readonly jobService: JobService,
		private readonly nl2BrPipe: Nl2BrPipe,
		private readonly truncatePipe: TruncatePipe
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this._applyTranslationOnSmartTable();
		this._loadSmartTableSettings();
		this.jobs$
			.pipe(
				debounceTime(100),
				tap(() => this.getEmployeesJob()),
				untilDestroyed(this)
			)
			.subscribe();
		this.nbTab$
			.pipe(
				debounceTime(100),
				distinctUntilChange(),
				tap(() => this.jobs$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
		this.pagination$
			.pipe(
				debounceTime(100),
				distinctUntilChange(),
				tap(() => this.jobs$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit(): void {
		const storeOrganization$ = this.store.selectedOrganization$;
		const storeEmployee$ = this.store.selectedEmployee$;
		combineLatest([storeOrganization$, storeEmployee$])
			.pipe(
				debounceTime(100),
				distinctUntilChange(),
				filter(([organization]) => !!organization),
				tap(([organization, employee]) => {
					this.organization = organization;
					this.selectedEmployeeId = employee ? employee.id : null;
					this.jobRequest.employeeIds = this.selectedEmployeeId ? [this.selectedEmployeeId] : [];
				}),
				tap(() => this.jobs$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	redirectToView() { }

	applyFilter() {
		this.jobs$.next(true);
	}

	async getEmployeeDefaultProposalTemplate(job: IJobMatchings) {
		return await this.proposalTemplateService
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

	setAutoRefresh(value: boolean) {
		if (value) {
			this.autoRefreshTimer = timer(0, 60000)
				.pipe(
					tap(() => this.jobs$.next(true)),
					untilDestroyed(this)
				)
				.subscribe();
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
						const proposalTemplate =
							await this.getEmployeeDefaultProposalTemplate(
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

	onSelectJob(event: any) {
		this.selectedJob = event;
	}

	public viewJob() {
		if (!this.selectedJob) {
			return;
		}
		if (this.selectedJob.data.jobPost) {
			window.open(this.selectedJob.data.jobPost.url, '_blank');
		}
	}

	public hideJob() {
		if (!this.selectedJob) {
			return;
		}
		const { employeeId, providerCode, providerJobId } = this.selectedJob.data;
		const hideRequest: IVisibilityJobPostInput = {
			hide: true,
			employeeId: employeeId,
			providerCode: providerCode,
			providerJobId: providerJobId
		};
		this.jobService.hideJob(hideRequest).then(() => {
			this.toastrService.success('TOASTR.MESSAGE.JOB_HIDDEN');
			this.smartTableSource.refresh();
		});
	}

	public applyToJob() {
		if (!this.selectedJob) {
			return;
		}
		const { employeeId, providerCode, providerJobId } = this.selectedJob.data;
		const applyRequest: IApplyJobPostInput = {
			applied: true,
			employeeId: employeeId,
			providerCode: providerCode,
			providerJobId: providerJobId
		};
		this.jobService.applyJob(applyRequest).then(async (resp) => {
			this.toastrService.success('TOASTR.MESSAGE.JOB_APPLIED');
			this.smartTableSource.refresh();

			if (resp.isRedirectRequired) {
				const proposalTemplate =
					await this.getEmployeeDefaultProposalTemplate(
						this.selectedJob.data
					);
				if (proposalTemplate) {
					await this.copyTextToClipboard(proposalTemplate.content);
				}
				window.open(this.selectedJob.data.jobPost.url, '_blank');
			}
		});
	}

	private _loadSmartTableSettings() {
		const pagination: IPaginationBase = this.getPagination();
		this.settingsSmartTable = {
			selectedRowIndex: -1,
			editable: false,
			hideSubHeader: true,
			actions: false,
			pager: {
				display: false,
				perPage: pagination ? pagination.itemsPerPage : 10
			},
			columns: {
				...(!this.selectedEmployeeId
					? {
						employee: {
							title: this.getTranslation('JOBS.EMPLOYEE'),

							filter: false,
							width: '15%',
							type: 'custom',
							sort: false,
							renderComponent: EmployeeLinksComponent,
							valuePrepareFunction: (
								cell,
								row: IEmployeeJobPost
							) => {
								return {
									name:
										row.employee && row.employee.user
											? row.employee.user.name
											: null,
									imageUrl:
										row.employee && row.employee.user
											? row.employee.user.imageUrl
											: null,
									id: row.employee
										? row.employee.id
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
					width: '5%',
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

	/*
	* Register Smart Table Source Config
	*/
	setSmartTableSource() {
		try {
			this.smartTableSource = new ServerDataSource(this.http, {
				endPoint: `${API_PREFIX}/employee-job`,
				pagerPageKey: 'page',
				pagerLimitKey: 'limit',
				relations: [],
				where: {
					...(this.selectedEmployeeId
						? {
							employeeId: this.selectedEmployeeId
						}
						: {}),
					...(this.filters.where ? this.filters.where : {})
				},
				finalize: () => {
					this.setPagination({
						...this.getPagination(),
						totalItems: this.smartTableSource.count()
					});
					this.loading = false;
				}
			});
		} catch (error) {
			console.log('Error while retrieving employee Job searches', error);
		}
	}

	private async getEmployeesJob() {
		try {
			this.setSmartTableSource();

			const { activePage, itemsPerPage } = this.getPagination();
			this.smartTableSource.setSort(
				[
					{
						field: 'status',
						direction: 'ASC'
					}
				],
				false
			);
			this.smartTableSource.setPaging(activePage, itemsPerPage, false);
		} catch (error) {
			this.toastrService.danger(error);
		}
	}

	private _applyTranslationOnSmartTable() {
		this.translateService.onLangChange
			.pipe(
				tap(() => this.jobs$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/*
	 * Hide all jobs
	 */
	hideAll() {
		const request: IVisibilityJobPostInput = {
			hide: true,
			...(this.selectedEmployeeId
				? { employeeId: this.selectedEmployeeId }
				: {})
		};
		this.jobService.hideJob(request).then(() => {
			this.toastrService.success('TOASTR.MESSAGE.JOB_HIDDEN');
			this.smartTableSource.refresh();
		});
	}

	onTabChange(tab: NbTabComponent) {
		this.nbTab$.next(tab.tabId);
	}

	searchJobs() {
		if (this.form.invalid) {
			return;
		}
		const { search, jobSource, jobType, jobStatus, budget } = this.form.getRawValue();
		if (search) {
			this.setFilter({ field: 'search', search: search }, false);
		}
		if (jobSource) {
			this.setFilter({ field: 'jobSource', search: jobSource }, false);
		}
		if (jobType) {
			this.setFilter({ field: 'jobType', search: jobType }, false);
		}
		if (jobStatus) {
			this.setFilter({ field: 'jobStatus', search: jobStatus }, false);
		}
		if (budget) {
			this.setFilter({ field: 'budget', search: budget }, false);
		}
	}

	reset() {
		this.form.reset();
		this._filters = {};
		this.jobs$.next(true);
	}

	ngOnDestroy(): void { }
}
