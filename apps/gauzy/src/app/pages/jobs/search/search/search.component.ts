import { Component, OnDestroy, OnInit, AfterViewInit, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, combineLatest, firstValueFrom, Subject, Subscription, timer } from 'rxjs';
import { debounceTime, filter, tap } from 'rxjs/operators';
import {
	IEmployeeJobApplication,
	IDateRangePicker,
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
import { distinctUntilChange, isEmpty, isNotEmpty, toUTC } from '@gauzy/common-angular';
import { NbDialogService, NbTabComponent } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { Ng2SmartTableComponent } from 'ng2-smart-table';
import { EmployeeLinksComponent } from './../../../../@shared/table-components';
import {
	IPaginationBase,
	PaginationFilterBaseComponent
} from '../../../../@shared/pagination/pagination-filter-base.component';
import { DateRangePickerBuilderService, JobService, Store, ToastrService } from './../../../../@core/services';
import { API_PREFIX } from './../../../../@core/constants';
import { AtLeastOneFieldValidator } from './../../../../@core/validators';
import { ServerDataSource } from './../../../../@core/utils/smart-table';
import { ProposalTemplateService } from '../../proposal-template/proposal-template.service';
import { ApplyJobManuallyComponent } from '../components';
import { JobTitleDescriptionDetailsComponent } from '../../table-components';
import { getAdjustDateRangeFutureAllowed } from './../../../../@theme/components/header/selectors/date-range-picker';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-job-search',
	templateUrl: './search.component.html',
	styleUrls: ['./search.component.scss']
})
export class SearchComponent extends PaginationFilterBaseComponent implements OnInit, OnDestroy, AfterViewInit {
	loading: boolean = false;
	isRefresh: boolean = false;
	autoRefresh: boolean = false;
	settingsSmartTable: object;
	isOpenAdvancedFilter: boolean = false;
	jobs: IEmployeeJobPost[] = [];

	JobPostSourceEnum = JobPostSourceEnum;
	JobPostTypeEnum = JobPostTypeEnum;
	JobPostStatusEnum = JobPostStatusEnum;
	PermissionsEnum = PermissionsEnum;
	JobSearchTabsEnum = JobSearchTabsEnum;

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
	disableButton: boolean = true;
	selectedJob: IEmployeeJobPost;

	nbTab$: Subject<string> = new BehaviorSubject(JobSearchTabsEnum.ACTIONS);

	public organization: IOrganization;
	public selectedEmployee: ISelectedEmployee;
	public selectedDateRange: IDateRangePicker;

	/*
	 * Search Tab Form
	 */
	public form: FormGroup = SearchComponent.buildForm(this.fb);
	static buildForm(fb: FormBuilder): FormGroup {
		return fb.group(
			{
				title: [],
				jobSource: [],
				jobType: [],
				jobStatus: [],
				budget: []
			},
			{
				validators: [AtLeastOneFieldValidator]
			}
		);
	}

	table: Ng2SmartTableComponent;
	@ViewChild('table') set content(content: Ng2SmartTableComponent) {
		if (content) {
			this.table = content;
		}
	}

	constructor(
		private readonly fb: FormBuilder,
		private readonly http: HttpClient,
		private readonly dialogService: NbDialogService,
		private readonly store: Store,
		public readonly translateService: TranslateService,
		public readonly proposalTemplateService: ProposalTemplateService,
		private readonly toastrService: ToastrService,
		private readonly jobService: JobService,
		private readonly dateRangePickerBuilderService: DateRangePickerBuilderService
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this._applyTranslationOnSmartTable();
		this.jobs$
			.pipe(
				debounceTime(100),
				tap(() => this.onSelectJob({ isSelected: false, data: null })),
				tap(async () => await this.getEmployeesJob()),
				tap(() => (this.isRefresh = false)),
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
		const selectedDateRange$ = this.dateRangePickerBuilderService.selectedDateRange$;
		combineLatest([storeOrganization$, selectedDateRange$, storeEmployee$])
			.pipe(
				debounceTime(100),
				distinctUntilChange(),
				filter(([organization, dateRange, employee]) => !!organization && !!dateRange),
				tap(([organization, dateRange, employee]) => {
					this.organization = organization;
					this.selectedDateRange = dateRange;
					this.selectedEmployee = employee && employee.id ? employee : null;
					this.jobRequest.employeeIds = this.selectedEmployee ? [this.selectedEmployee.id] : [];
				}),
				tap(() => this._loadSmartTableSettings()),
				tap(() => this.jobs$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/** Get employee default proposal template */
	async getEmployeeDefaultProposalTemplate(job: IJobMatchings) {
		if (!this.organization) {
			return;
		}

		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;
		const { employeeId } = job;

		const { items = [] } = await this.proposalTemplateService.getAll({
			where: {
				tenantId,
				organizationId,
				employeeId,
				isDefault: true
			}
		});
		return items.length > 0 ? items[0] : null;
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
					tap(() => this.refresh()),
					untilDestroyed(this)
				)
				.subscribe();
		} else {
			if (this.autoRefreshTimer) {
				this.autoRefreshTimer.unsubscribe();
			}
		}
	}

	/**
	 * Custom events
	 *
	 * @param $event
	 */
	async onCustomEvents($event: { action: string; data: any }) {
		switch ($event.action) {
			case 'view':
				if ($event.data.jobPost) {
					window.open($event.data.jobPost.url, '_blank');
				}
				break;
			case 'apply':
				const applyRequest: IEmployeeJobApplication = {
					applied: true,
					employeeId: $event.data.employeeId,
					providerCode: $event.data.providerCode,
					providerJobId: $event.data.providerJobId
				};
				this.jobService.applyJob(applyRequest).then(async (resp) => {
					this.toastrService.success('TOASTR.MESSAGE.JOB_APPLIED');
					this.smartTableSource.refresh();

					if (resp.isRedirectRequired) {
						const proposalTemplate = await this.getEmployeeDefaultProposalTemplate($event.data);
						if (proposalTemplate) {
							await this.copyTextToClipboard(proposalTemplate.content);
						}
						window.open($event.data.jobPost.url, '_blank');
					}
				});
				break;
			case 'hide':
				try {
					await this.hideJobPost({
						hide: true,
						employeeId: $event.data.employeeId,
						providerCode: $event.data.providerCode,
						providerJobId: $event.data.providerJobId
					});

					this.toastrService.success('TOASTR.MESSAGE.JOB_HIDDEN');
					this.smartTableSource.refresh();
				} catch (error) {
					console.log('Error while hide job', error);
				}
				break;
			default:
				break;
		}
	}

	/**
	 * On select job search Row
	 *
	 * @param param0
	 */
	onSelectJob({ isSelected, data }) {
		this.disableButton = !isSelected;
		this.selectedJob = isSelected ? data : null;
	}

	public viewJob() {
		if (!this.selectedJob) {
			return;
		}
		if (this.selectedJob.jobPost) {
			window.open(this.selectedJob.jobPost.url, '_blank');
		}
	}

	/**
	 * Updates job visibility
	 *
	 * @returns
	 */
	public async hideJob() {
		if (!this.selectedJob) {
			return;
		}

		try {
			const { employeeId, providerCode, providerJobId } = this.selectedJob;
			await this.hideJobPost({ hide: true, employeeId, providerCode, providerJobId });

			this.toastrService.success('TOASTR.MESSAGE.JOB_HIDDEN');
			this.smartTableSource.refresh();

			this.onSelectJob({ isSelected: false, data: null });
		} catch (error) {
			console.log('Error while hide job', error);
		}
	}

	/**
	 * Updates job visibility
	 *
	 * @param input
	 */
	public async hideJobPost(input: IVisibilityJobPostInput) {
		try {
			const { employeeId, providerCode, providerJobId } = input;
			if (providerCode && providerJobId) {
				const payload: IVisibilityJobPostInput = {
					hide: true,
					employeeId: employeeId,
					providerCode: providerCode,
					providerJobId: providerJobId
				};
				await this.jobService.hideJob(payload);
			}
		} catch (error) {
			console.log('Error while hide job', error);
		}
	}

	/**
	 * Already applied job from provider site
	 *
	 * @returns
	 */
	async appliedJob() {
		if (!this.selectedJob) {
			return;
		}
		try {
			const { employeeId, providerCode, providerJobId } = this.selectedJob;
			await this.jobService.updateApplied({
				employeeId,
				providerCode,
				providerJobId,
				applied: true
			});

			this.toastrService.success('TOASTR.MESSAGE.JOB_APPLIED');
			this.smartTableSource.refresh();
		} catch (error) {
			console.log('Error while applied job', error);
		}
	}

	/**
	 * Apply For Job Post
	 *
	 * @param applyJobPost
	 * @returns
	 */
	async applyToJob(applyJobPost: IEmployeeJobApplication): Promise<void> {
		if (!this.selectedJob) {
			return;
		}

		try {
			const appliedJob = await this.jobService.applyJob(applyJobPost);
			this.toastrService.success('TOASTR.MESSAGE.JOB_APPLIED');

			// removed selected row from table after applied
			const row = document.querySelector('ng2-smart-table > table > tbody > .ng2-smart-row.selected');
			if (!!row) {
				row.remove();
				this.onSelectJob({ isSelected: false, data: null });
			}

			if (appliedJob.isRedirectRequired) {
				// If we have generated proposal, let's copy to clipboard
				if (appliedJob.proposal) {
					await this.copyTextToClipboard(appliedJob.proposal);
				} else {
					const proposalTemplate = await this.getEmployeeDefaultProposalTemplate(this.selectedJob);
					if (proposalTemplate) {
						await this.copyTextToClipboard(proposalTemplate.content);
					}
				}
				window.open(this.selectedJob.jobPost.url, '_blank');
			}
		} catch (error) {
			console.log('Error while applying job post', error);
		}
	}

	/** Apply For Job Automatically */
	async applyToJobAutomatically() {
		if (!this.selectedJob) {
			return;
		}
		try {
			const { providerCode, providerJobId, employeeId } = this.selectedJob;
			const applyJobPost: IEmployeeJobApplication = {
				applied: true,
				...(isNotEmpty(this.selectedEmployee)
					? {
						employeeId: this.selectedEmployee.id
					}
					: {
						employeeId
					}),
				providerCode,
				providerJobId
			};

			await this.applyToJob(applyJobPost);
		} catch (error) {
			console.log('Error while applying job post automatically', error);
		}
	}

	/** Apply For Job Manually */
	async applyToJobManually() {
		if (!this.selectedJob) {
			return;
		}

		const dialog = this.dialogService.open(ApplyJobManuallyComponent, {
			context: {
				employeeJobPost: this.selectedJob,
				selectedEmployee: this.selectedEmployee
			},
			hasScroll: false
		});

		const result = await firstValueFrom<IEmployeeJobApplication>(dialog.onClose);

		if (result) {
			const { providerCode, providerJobId } = this.selectedJob;

			const { applied, employeeId, proposal, rate, details, attachments } = result;

			try {
				const applyJobPost: IEmployeeJobApplication = {
					applied,
					employeeId,
					proposal,
					rate,
					details,
					attachments,
					providerCode,
					providerJobId
				};

				await this.applyToJob(applyJobPost);
			} catch (error) {
				console.log('Error while applying job post manually', error);
			}
		}
	}

	private _loadSmartTableSettings() {
		const self: SearchComponent = this;

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
				...(isEmpty(this.selectedEmployee)
					? {
						employee: {
							title: this.getTranslation('JOBS.EMPLOYEE'),
							filter: false,
							width: '15%',
							type: 'custom',
							sort: false,
							renderComponent: EmployeeLinksComponent,
							valuePrepareFunction: (cell, row: IEmployeeJobPost) => {
								return {
									name: row.employee && row.employee.user ? row.employee.user.name : null,
									imageUrl: row.employee && row.employee.user ? row.employee.user.imageUrl : null,
									id: row.employee ? row.employee.id : null
								};
							}
						}
					}
					: {}),
				jobDetails: {
					title: this.getTranslation('JOBS.JOB_DETAILS'),
					width: '85%',
					type: 'custom',
					renderComponent: JobTitleDescriptionDetailsComponent,
					filter: false,
					sort: false,
					onComponentInitFunction(instance: any) {
						instance.hideJobEvent.subscribe((event: IVisibilityJobPostInput) => {
							self.onCustomEvents({ action: 'hide', data: event });
						});
					}
				}
			}
		};
	}

	/*
	 * Register Smart Table Source Config
	 */
	setSmartTableSource() {
		if (!this.organization) {
			return;
		}
		try {
			/**
			 * Initiate smart table source configuration
			 */
			this.smartTableSource = new ServerDataSource(this.http, {
				endPoint: `${API_PREFIX}/employee-job`,
				pagerPageKey: 'page',
				pagerLimitKey: 'limit',
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
		if (!this.organization) {
			return;
		}

		try {
			this.setSmartTableSource();
		} catch (error) {
			console.log('Error while set smart table source configuration', error);
		}

		try {
			const { activePage, itemsPerPage } = this.getPagination();
			const { title, jobSource, jobType, jobStatus, budget } = this.form.value;
			const { startDate, endDate } = getAdjustDateRangeFutureAllowed(this.selectedDateRange);
			const { id: organizationId } = this.organization;

			/**
			 * Set header selectors filters configuration
			 */
			this.smartTableSource.setFilter(
				[
					...(isNotEmpty(organizationId)
						? [
							{
								field: 'organizationId',
								search: organizationId
							}
						]
						: []),
					...(isNotEmpty(this.selectedEmployee)
						? [
							{
								field: 'employeeIds',
								search: [this.selectedEmployee.id]
							}
						]
						: []),

					...(startDate && endDate
						? [
							{
								field: 'jobDateCreated',
								search: {
									between: {
										lower: toUTC(startDate).format('YYYY-MM-DD HH:mm:ss'),
										upper: toUTC(endDate).format('YYYY-MM-DD HH:mm:ss')
									}
								}
							}
						]
						: []),
					...(title
						? [
							{
								field: 'title',
								search: title
							}
						]
						: []),
					...(jobSource
						? [
							{
								field: 'jobSource',
								search: jobSource
							}
						]
						: []),
					...(jobType
						? [
							{
								field: 'jobType',
								search: jobType
							}
						]
						: []),
					...(jobStatus
						? [
							{
								field: 'jobStatus',
								search: jobStatus
							}
						]
						: []),
					...(budget
						? [
							{
								field: 'budget',
								search: budget
							}
						]
						: []),
					// Get only fresh jobs (not applied yet)
					...(true
						? [
							{
								field: 'isApplied',
								search: 'false'
							}
						]
						: [])
				],
				false,
				false
			);
			/**
			 * Set smart table sorting filters configuration
			 */
			this.smartTableSource.setSort(
				[
					{
						field: 'status',
						direction: 'ASC'
					}
				],
				false
			);
			/**
			 * Applied smart table pagination configuration
			 */
			this.smartTableSource.setPaging(activePage, itemsPerPage, false);
		} catch (error) {
			this.toastrService.danger(error);
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

	/*
	 * Hide all jobs
	 */
	hideAll() {
		const request: IVisibilityJobPostInput = {
			hide: true,
			...(isNotEmpty(this.selectedEmployee) ? { employeeId: this.selectedEmployee.id } : {})
		};
		this.jobService.hideJob(request).then(() => {
			this.toastrService.success('TOASTR.MESSAGE.JOB_HIDDEN');
			this.smartTableSource.refresh();
		});
	}

	onTabChange(tab: NbTabComponent) {
		this.form.reset();
		this.nbTab$.next(tab.tabId);
	}

	searchJobs() {
		if (this.form.invalid) {
			return;
		}
		this.jobs$.next(true);
	}

	/** Submit form enter key */
	handleSubmitOnEnter() {
		this.searchJobs();
	}

	reset() {
		this.form.reset();
		this._filters = {};
		this.refresh();
	}

	public refresh(): void {
		this.isRefresh = true;
		this.pagination = {
			...this.pagination,
			activePage: 1,
			itemsPerPage: this.minItemPerPage
		};
		this.scrollTop();
		this.jobs$.next(true);
	}

	ngOnDestroy(): void { }
}
