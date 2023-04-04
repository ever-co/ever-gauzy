
import {
	Component,
	OnDestroy,
	OnInit,
	AfterViewInit
} from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, combineLatest, firstValueFrom, Subject, Subscription, timer } from 'rxjs';
import { debounceTime, filter, tap } from 'rxjs/operators';
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
import { NbDialogService, NbTabComponent } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { EmployeeLinksComponent } from './../../../../@shared/table-components';
import { IPaginationBase, PaginationFilterBaseComponent } from '../../../../@shared/pagination/pagination-filter-base.component';
import { JobService, Store, ToastrService } from './../../../../@core/services';
import { StatusBadgeComponent } from './../../../../@shared/status-badge';
import { API_PREFIX } from './../../../../@core/constants';
import { AtLeastOneFieldValidator } from './../../../../@core/validators';
import { ServerDataSource } from './../../../../@core/utils/smart-table';
import { ProposalTemplateService } from '../../proposal-template/proposal-template.service';
import { ApplyJobManuallyComponent } from '../components';
import { JobTitleDescriptionDetailsComponent } from '../../table-components';

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
	public selectedEmployeeId: ISelectedEmployee['id'];

	/*
	* Search Tab Form
	*/
	public form: FormGroup = SearchComponent.buildForm(this.fb);
	static buildForm(fb: FormBuilder): FormGroup {
		return fb.group({
			title: [],
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
		private readonly dialogService: NbDialogService,
		private readonly store: Store,
		public readonly translateService: TranslateService,
		public readonly proposalTemplateService: ProposalTemplateService,
		private readonly toastrService: ToastrService,
		private readonly jobService: JobService
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this._applyTranslationOnSmartTable();
		this.jobs$
			.pipe(
				debounceTime(100),
				tap(() => this._loadSmartTableSettings()),
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

	public hideJob() {
		if (!this.selectedJob) {
			return;
		}
		const { employeeId, providerCode, providerJobId } = this.selectedJob;
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

	/** Apply For Job Manually */
	async applyToJob(): Promise<void> {
		if (!this.selectedJob) {
			return;
		}
		const dialog = this.dialogService.open(ApplyJobManuallyComponent, {
			context: {
				jobPost: this.selectedJob,
				selectedEmployeeId: this.selectedEmployeeId
			}
		});
		const result = await firstValueFrom<IApplyJobPostInput>(dialog.onClose);
		if (result) {
			const { providerCode, providerJobId } = this.selectedJob;
			const { applied, employeeId, proposal, rate, details, attachments } = result;

			const applyJobPost: IApplyJobPostInput = {
				applied,
				employeeId,
				proposal,
				rate,
				details,
				attachments,
				providerCode,
				providerJobId,
			};

			try {
				const appliedJob = await this.jobService.applyJob(applyJobPost);

				this.toastrService.success('TOASTR.MESSAGE.JOB_APPLIED');
				this.smartTableSource.refresh();

				if (appliedJob.isRedirectRequired) {
					const proposalTemplate = await this.getEmployeeDefaultProposalTemplate(
						this.selectedJob
					);
					if (proposalTemplate) {
						await this.copyTextToClipboard(proposalTemplate.content);
					}
					window.open(this.selectedJob.jobPost.url, '_blank');
				}
			} catch (error) {
				console.log('Error while applying job post', error);
			}
		}
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
					type: 'custom',
					renderComponent: JobTitleDescriptionDetailsComponent,
					filter: false,
					sort: false
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
							cell = this.getTranslation('JOBS.CLOSED');
						} else if (
							row.jobPost.jobStatus.toLowerCase() ===
							JobPostStatusEnum.OPEN.toLowerCase()
						) {
							badgeClass = 'success';
							cell = this.getTranslation('JOBS.OPEN');
						} else if (
							row.jobPost.jobStatus.toLowerCase() ===
							JobPostStatusEnum.APPLIED.toLowerCase()
						) {
							badgeClass = 'warning';
							cell = this.getTranslation('JOBS.APPLIED');
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
			/**
			 * Set header selectors filters configuration
			 */
			this.smartTableSource.setFilter(
				[
					...(
						this.selectedEmployeeId ? [
							{
								field: 'employeeIds',
								search: [
									this.selectedEmployeeId
								]
							}
						] : []
					),
					...(
						title ? [
							{
								field: 'title',
								search: title
							}
						] : []
					),
					...(
						jobSource ? [
							{
								field: 'jobSource',
								search: jobSource
							}
						] : []
					),
					...(
						jobType ? [
							{
								field: 'jobType',
								search: jobType
							}
						] : []
					),
					...(
						jobStatus ? [
							{
								field: 'jobStatus',
								search: jobStatus
							}
						] : []
					),
					...(
						budget ? [
							{
								field: 'budget',
								search: budget
							}
						] : []
					),
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
			this.smartTableSource.setPaging(
				activePage,
				itemsPerPage,
				false
			);
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
		this.jobs$.next(true);
	}

	reset() {
		this.form.reset();
		this._filters = {};
		this.jobs$.next(true);
	}

	ngOnDestroy(): void { }
}
