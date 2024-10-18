import { AfterViewInit, Component, OnDestroy, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Data, Router } from '@angular/router';
import { BehaviorSubject, combineLatest, firstValueFrom, map, merge, Subject, Subscription, timer } from 'rxjs';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { NbDialogService, NbTabComponent } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { Cell } from 'angular2-smart-table';
import { NgxPermissionsService } from 'ngx-permissions';
import {
	AtLeastOneFieldValidator,
	DateRangePickerBuilderService,
	ErrorHandlingService,
	ProposalTemplateService,
	ServerDataSource,
	Store,
	ToastrService
} from '@gauzy/ui-core/core';
import {
	IEmployeeJobApplication,
	IDateRangePicker,
	IEmployeeJobPost,
	IJobMatchings,
	IOrganization,
	ISelectedEmployee,
	IVisibilityJobPostInput,
	JobPostSourceEnum,
	JobPostStatusEnum,
	JobPostTypeEnum,
	JobSearchTabsEnum,
	PermissionsEnum,
	IEmployee,
	IIntegrationEntitySetting,
	IntegrationEntity,
	IEmployeeProposalTemplate,
	LanguagesEnum
} from '@gauzy/contracts';
import { JobService } from '@gauzy/ui-core/core';
import { I18nService } from '@gauzy/ui-core/i18n';
import {
	EmployeeLinksComponent,
	IPaginationBase,
	PaginationFilterBaseComponent,
	getAdjustDateRangeFutureAllowed
} from '@gauzy/ui-core/shared';
import { API_PREFIX, distinctUntilChange, isNotEmpty, toUTC } from '@gauzy/ui-core/common';
import { ApplyJobManuallyComponent } from '../apply-job-manually/apply-job-manually.component';
import { JobTitleDescriptionDetailsComponent } from '../job-title-description-details/job-title-description-details.component';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-job-search',
	templateUrl: './job-search.component.html',
	styleUrls: ['./job-search.component.scss']
})
export class JobSearchComponent extends PaginationFilterBaseComponent implements AfterViewInit, OnInit, OnDestroy {
	loading: boolean = false;
	isRefresh: boolean = false;
	autoRefresh: boolean = false;
	settingsSmartTable: any = {
		selectedRowIndex: -1,
		editable: false,
		hideSubHeader: true,
		actions: false
	};
	isOpenAdvancedFilter: boolean = false;
	jobs: IEmployeeJobPost[] = [];
	JobPostSourceEnum = JobPostSourceEnum;
	JobPostTypeEnum = JobPostTypeEnum;
	JobPostStatusEnum = JobPostStatusEnum;
	PermissionsEnum = PermissionsEnum;
	JobSearchTabsEnum = JobSearchTabsEnum;
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
	public form: UntypedFormGroup = JobSearchComponent.buildForm(this._fb);
	static buildForm(fb: UntypedFormBuilder): UntypedFormGroup {
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

	constructor(
		readonly translateService: TranslateService,
		private readonly _fb: UntypedFormBuilder,
		private readonly _http: HttpClient,
		private readonly _activatedRoute: ActivatedRoute,
		private readonly _router: Router,
		private readonly _dialogService: NbDialogService,
		private readonly _store: Store,
		private readonly _proposalTemplateService: ProposalTemplateService,
		private readonly _toastrService: ToastrService,
		private readonly _jobService: JobService,
		private readonly _dateRangePickerBuilderService: DateRangePickerBuilderService,
		private readonly _errorHandlingService: ErrorHandlingService,
		private readonly _ngxPermissionsService: NgxPermissionsService,
		private readonly _i18nService: I18nService
	) {
		super(translateService);

		// Creating the observable pipeline
		this._activatedRoute.data
			.pipe(
				filter(({ integration }: Data) => {
					if (!integration) {
						this._router.navigate(['/pages/jobs']);
						return false;
					}
					return true; // Continue with the pipeline if integration is found
				}),
				// Extracting the 'entitySettings' property from the 'integration_tenant' object in the route's data
				map(({ integration }: Data) => integration?.entitySettings),
				// Finding the entity setting related to the specified entity type
				map((entitySettings: IIntegrationEntitySetting[]) =>
					entitySettings.find((setting) => setting.entity === IntegrationEntity.JOB_MATCHING)
				),
				// Updating the specified component property with the fetched entity setting
				tap((entity: IIntegrationEntitySetting) => {
					if (!entity || !entity.sync || !entity.isActive) {
						this._router.navigate(['/pages/jobs']);
					}
				}),
				// Handling the component lifecycle to avoid memory leaks
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngOnInit(): void {
		this._applyTranslationOnSmartTable();
		// Initialize UI permissions
		this.initializeUiPermissions();
		// Initialize UI languages and Update Locale
		this.initializeUiLanguagesAndLocale();
		this.jobs$
			.pipe(
				debounceTime(100),
				tap(() => this.onSelectJob({ isSelected: false, data: null })),
				tap(async () => await this.getEmployeeJobs()),
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
		const storeOrganization$ = this._store.selectedOrganization$;
		const storeEmployee$ = this._store.selectedEmployee$;
		const selectedDateRange$ = this._dateRangePickerBuilderService.selectedDateRange$;
		combineLatest([storeOrganization$, selectedDateRange$, storeEmployee$])
			.pipe(
				debounceTime(100),
				distinctUntilChange(),
				filter(([organization, dateRange]) => !!organization && !!dateRange),
				tap(([organization, dateRange, employee]) => {
					this.organization = organization;
					this.selectedDateRange = dateRange;
					this.selectedEmployee = employee && employee.id ? employee : null;
				}),
				tap(() => this._loadSmartTableSettings()),
				tap(() => this.jobs$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Initialize UI permissions
	 */
	private initializeUiPermissions() {
		// Load permissions
		const permissions = this._store.userRolePermissions.map(({ permission }) => permission);
		this._ngxPermissionsService.flushPermissions(); // Flush permissions
		this._ngxPermissionsService.loadPermissions(permissions); // Load permissions
	}

	/**
	 * Initialize UI languages and Update Locale
	 */
	private initializeUiLanguagesAndLocale() {
		// Observable that emits when preferred language changes.
		const preferredLanguage$ = merge(this._store.preferredLanguage$, this._i18nService.preferredLanguage$).pipe(
			distinctUntilChange(),
			filter((lang: string | LanguagesEnum) => !!lang),
			tap((lang: string | LanguagesEnum) => {
				this.translateService.use(lang);
			}),
			untilDestroyed(this)
		);

		// Subscribe to initiate the stream
		preferredLanguage$.subscribe();
	}

	/**
	 * Retrieves the default proposal template for the specified employee and organization.
	 * @param {IJobMatchings} job - The job matching object containing employeeId.
	 * @returns {Promise<any>} A promise resolving to the default proposal template or null if not found.
	 */
	async getEmployeeDefaultProposalTemplate(job: IJobMatchings): Promise<IEmployeeProposalTemplate | null> {
		// Check if organization context is available
		if (!this.organization) {
			return null;
		}

		// Extract necessary IDs
		const { id: organizationId, tenantId } = this.organization;
		const { employeeId } = job;

		// Retrieve proposal templates matching criteria
		const { items = [] } = await this._proposalTemplateService.getAll({
			where: {
				tenantId,
				organizationId,
				employeeId,
				isDefault: true
			}
		});

		// Return the first matching default template or null if not found
		return items.length > 0 ? items[0] : null;
	}

	/**
	 * Copies the given text to the clipboard.
	 * @param {string} text - The text to be copied to the clipboard.
	 * @returns {Promise<void>} A promise that resolves when the text is copied.
	 */
	async copyTextToClipboard(text: string): Promise<void | boolean> {
		if (!navigator.clipboard) {
			// Fallback method for older browsers that do not support navigator.clipboard API
			const textArea = document.createElement('textarea');
			textArea.value = text;

			// Avoid scrolling to bottom
			textArea.style.position = 'fixed';
			textArea.style.opacity = '0'; // Make textarea invisible

			document.body.appendChild(textArea);
			textArea.focus();
			textArea.select();

			try {
				const successful = document.execCommand('copy');
				if (!successful) {
					throw new Error('Fallback: Copy command was unsuccessful');
				}
				console.log('Fallback: Copying text command was successful');
			} catch (error) {
				console.error('Fallback: Oops, unable to copy', error);
				throw new Error(`Fallback: Copy command was unsuccessful: ${error?.message}`);
			} finally {
				document.body.removeChild(textArea); // Clean up
			}
		} else {
			// Modern method using navigator.clipboard API
			try {
				await navigator.clipboard.writeText(text);
				console.log('Async: Copying to clipboard was successful!');
			} catch (error) {
				console.error('Async: Could not copy text: ', error);
				throw new Error(`Async: Could not copy text: ${error?.message}`);
			}
		}
	}

	/**
	 * Sets the auto refresh behavior based on the provided value.
	 * @param {boolean} value - If true, enables auto refresh; if false, disables it.
	 */
	setAutoRefresh(value: boolean): void {
		if (value) {
			// Enable auto refresh
			this.autoRefreshTimer = timer(0, 60000) // Timer starts immediately and fires every 60 seconds
				.pipe(
					tap(() => this.refresh()), // Perform the refresh action on each timer tick
					untilDestroyed(this) // Automatically unsubscribe when component is destroyed
				)
				.subscribe();
		} else {
			// Disable auto refresh
			if (this.autoRefreshTimer instanceof Subscription) {
				this.autoRefreshTimer.unsubscribe(); // Unsubscribe from the timer observable
				this.autoRefreshTimer = null; // Clear the timer reference
			}
		}
	}

	/**
	 * Handles custom events related to job actions such as viewing, applying, and hiding jobs.
	 * @param $event The custom event containing action and data payload.
	 */
	async onCustomEvents($event: { action: string; data: any }) {
		switch ($event.action) {
			case 'view':
				if ($event.data.jobPost) {
					window.open($event.data.jobPost.url, '_blank');
				}
				break;
			case 'apply':
				// Define the applyRequest object
				const applyRequest: IEmployeeJobApplication = {
					applied: true,
					employeeId: $event.data.employeeId,
					providerCode: $event.data.providerCode,
					providerJobId: $event.data.providerJobId
				};

				try {
					// Await the applyJob function call
					const resp = await this._jobService.applyJob(applyRequest);

					// Show success message and refresh smart table
					this._toastrService.success('TOASTR.MESSAGE.JOB_APPLIED');
					this.smartTableSource.refresh();

					// Check if a redirect is required
					if (resp.isRedirectRequired) {
						// Fetch the proposal template
						const proposalTemplate = await this.getEmployeeDefaultProposalTemplate($event.data);
						if (proposalTemplate) {
							// Copy proposal content to clipboard
							await this.copyTextToClipboard(proposalTemplate.content);
						}
						// Open a new window with job post URL
						window.open($event.data.jobPost.url, '_blank');
					}
				} catch (error) {
					console.error('Error while applying job:', error);
					// Optionally show an error message or handle the error scenario
					this._errorHandlingService.handleError(error);
				}
				break;
			case 'hide':
				try {
					await this.hideJobPost({
						hide: true,
						employeeId: $event.data.employeeId,
						providerCode: $event.data.providerCode,
						providerJobId: $event.data.providerJobId
					});

					this._toastrService.success('TOASTR.MESSAGE.JOB_HIDDEN');
					this.smartTableSource.refresh();
				} catch (error) {
					console.log('Error while hide job', error);
					// Optionally show an error message or handle the error scenario
					this._errorHandlingService.handleError(error);
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

	/**
	 * Opens the job post URL in a new tab if a job is selected and has a valid URL.
	 */
	public viewJob(): void {
		if (!this.selectedJob) {
			return;
		}

		if (this.selectedJob.jobPost && this.selectedJob.jobPost.url) {
			window.open(this.selectedJob.jobPost.url, '_blank');
		}
	}

	/**
	 * Updates job visibility by hiding the selected job post.
	 * Displays success message on job hidden and refreshes the smart table source.
	 */
	public async hideJob(): Promise<void> {
		// Check if a job is selected
		if (!this.selectedJob) {
			return;
		}

		try {
			// Destructure selected job properties
			const { employeeId, providerCode, providerJobId } = this.selectedJob;

			// Call service method to hide the job post
			await this.hideJobPost({ hide: true, employeeId, providerCode, providerJobId });

			// Display success message using toastr service
			this._toastrService.success('TOASTR.MESSAGE.JOB_HIDDEN');

			// Refresh the smart table source
			this.smartTableSource.refresh();

			// Clear selection of the job post
			this.onSelectJob({ isSelected: false, data: null });
		} catch (error) {
			// Log and handle any errors that occur during hiding the job post
			console.error('Error while hiding job', error);
			this._toastrService.error('TOASTR.MESSAGE.ERROR_HIDING_JOB');
		}
	}

	/**
	 * Updates job visibility by hiding the job post based on the provided input.
	 *
	 * @param input The input data containing employee ID, provider code, and provider job ID.
	 */
	public async hideJobPost(input: IVisibilityJobPostInput): Promise<void> {
		try {
			const { employeeId, providerCode, providerJobId } = input;

			// Check if provider code and provider job ID are provided
			if (providerCode && providerJobId) {
				// Prepare payload for hiding job post
				const payload: IVisibilityJobPostInput = {
					hide: true,
					employeeId,
					providerCode,
					providerJobId
				};

				// Call job service method to hide the job post
				await this._jobService.hideJob(payload);
			}
		} catch (error) {
			// Log and handle any errors that occur during hiding the job post
			console.error('Error while hiding job', error);
		}
	}

	/**
	 * Marks the selected job as already applied on the provider site.
	 * Updates job application status and refreshes the smart table source.
	 */
	async appliedJob(): Promise<void> {
		// Check if a job is selected
		if (!this.selectedJob) {
			return;
		}

		try {
			// Destructure selected job properties
			const { employeeId, providerCode, providerJobId } = this.selectedJob;

			// Call job service method to update job application status
			await this._jobService.updateApplied({
				employeeId,
				providerCode,
				providerJobId,
				applied: true
			});

			// Display success message using toastr service
			this._toastrService.success('TOASTR.MESSAGE.JOB_APPLIED');

			// Refresh the smart table source
			this.smartTableSource.refresh();
		} catch (error) {
			// Log and handle any errors that occur during updating job application status
			console.error('Error while marking job as applied', error);
			this._toastrService.error('TOASTR.MESSAGE.ERROR_APPLYING_JOB');
		}
	}

	/**
	 * Apply for a job post using the provided job application details.
	 *
	 * @param applyJobPost The job application details.
	 */
	async applyToJob(applyJobPost: IEmployeeJobApplication): Promise<void> {
		// Check if a job is selected
		if (!this.selectedJob) {
			return;
		}

		try {
			// Apply for the job using job service method
			const appliedJob = await this._jobService.applyJob(applyJobPost);

			// Display success message using toastr service
			this._toastrService.success('TOASTR.MESSAGE.JOB_APPLIED');

			// Remove the selected row from the table after applying
			const row = document.querySelector('angular2-smart-table > table > tbody > .angular2-smart-row.selected');
			if (row) {
				row.remove();
				this.onSelectJob({ isSelected: false, data: null });
			}

			// Handle redirection and proposal copying if required
			if (appliedJob.isRedirectRequired) {
				// Copy proposal to clipboard if generated, else use default proposal template
				if (appliedJob.proposal) {
					await this.copyTextToClipboard(appliedJob.proposal);
				} else {
					const proposalTemplate = await this.getEmployeeDefaultProposalTemplate(this.selectedJob);
					if (proposalTemplate) {
						await this.copyTextToClipboard(proposalTemplate.content);
					}
				}
				// Open job post URL in a new tab
				window.open(this.selectedJob.jobPost.url, '_blank');
			}
		} catch (error) {
			// Log and handle any errors that occur during job application
			console.error('Error while applying job post', error);
			this._toastrService.error('TOASTR.MESSAGE.ERROR_APPLYING_JOB');
		}
	}

	/**
	 * Apply for a job automatically using the selected job details.
	 */
	async applyToJobAutomatically() {
		// Check if a job is selected
		if (!this.selectedJob) {
			return;
		}

		try {
			// Prepare job application details
			const { providerCode, providerJobId, employeeId } = this.selectedJob;
			const applyJobPost: IEmployeeJobApplication = {
				applied: true,
				// Choose employeeId based on whether selectedEmployee is defined
				...(this.selectedEmployee?.id ? { employeeId: this.selectedEmployee.id } : { employeeId }),
				providerCode,
				providerJobId
			};

			// Apply for the job using applyToJob method
			await this.applyToJob(applyJobPost);
		} catch (error) {
			// Log and handle any errors that occur during automatic job application
			console.error('Error while applying job post automatically', error);
		}
	}

	/**
	 * Apply for a job manually using a dialog component.
	 */
	async applyToJobManually() {
		// Check if a job is selected
		if (!this.selectedJob) {
			return;
		}

		// Open a dialog to handle manual job application
		const dialog = this._dialogService.open(ApplyJobManuallyComponent, {
			context: {
				employeeJobPost: this.selectedJob,
				selectedEmployee: this.selectedEmployee
			},
			hasScroll: false
		});

		try {
			// Wait for dialog result
			const result = await firstValueFrom<IEmployeeJobApplication>(dialog.onClose);

			// Process job application if result is available
			if (result) {
				const { providerCode, providerJobId } = this.selectedJob;
				const { applied, employeeId, proposal, rate, details, attachments } = result;

				// Prepare job application details
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

				// Apply for the job using applyToJob method
				await this.applyToJob(applyJobPost);
			}
		} catch (error) {
			// Log and handle any errors that occur during manual job application
			console.error('Error while applying job post manually', error);
		}
	}

	/**
	 * Loads smart table settings.
	 */
	private _loadSmartTableSettings() {
		const self: JobSearchComponent = this;

		const pagination: IPaginationBase = this.getPagination();
		this.settingsSmartTable = {
			...this.settingsSmartTable,
			pager: {
				display: false,
				perPage: pagination ? pagination.itemsPerPage : 10
			},
			columns: {
				...(this.selectedEmployee?.id
					? {}
					: {
							employee: {
								title: this.getTranslation('JOBS.EMPLOYEE'),
								isFilterable: false,
								width: '15%',
								type: 'custom',
								isSortable: false,
								renderComponent: EmployeeLinksComponent,
								componentInitFunction: (instance: EmployeeLinksComponent, cell: Cell) => {
									// Get row data
									const employee: IEmployee = cell.getRawValue() as IEmployee;
									instance.rowData = cell.getRow().getData();

									// Set value
									instance.value = {
										name: employee?.user?.name ?? null,
										imageUrl: employee?.user?.imageUrl ?? null,
										id: employee?.id ?? null
									};
								}
							}
					  }),
				jobDetails: {
					title: this.getTranslation('JOBS.JOB_DETAILS'),
					width: '85%',
					type: 'custom',
					isFilterable: false,
					isSortable: false,
					renderComponent: JobTitleDescriptionDetailsComponent,
					componentInitFunction(instance: JobTitleDescriptionDetailsComponent, cell: Cell) {
						// Get row data
						instance.rowData = cell.getRow().getData();

						// Hide job event
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
			this.smartTableSource = new ServerDataSource(this._http, {
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
			this._errorHandlingService.handleError(error);
		}
	}

	/**
	 * Retrieves employee jobs based on various filters and sets the smart table data source.
	 * @returns Promise<void>
	 */
	private async getEmployeeJobs() {
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
			const { id: organizationId, tenantId } = this.organization;

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
								},
								{
									field: 'tenantId',
									search: tenantId
								}
						  ]
						: []),
					...(isNotEmpty(this.selectedEmployee?.id)
						? [
								{
									field: 'employeeIds',
									search: [this.selectedEmployee?.id]
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
				false
			);
			/**
			 * Set smart table sorting filters configuration
			 */
			this.smartTableSource.setSort(
				[
					{
						field: 'status',
						direction: 'asc'
					}
				],
				false
			);
			/**
			 * Applied smart table pagination configuration
			 */
			this.smartTableSource.setPaging(activePage, itemsPerPage, false);
		} catch (error) {
			this._toastrService.danger(error);
		}
	}

	/*
	 * Hide all jobs
	 */
	async hideAll() {
		const request: IVisibilityJobPostInput = {
			hide: true,
			...(isNotEmpty(this.selectedEmployee) ? { employeeId: this.selectedEmployee.id } : {})
		};

		try {
			await this._jobService.hideJob(request);
			this._toastrService.success('TOASTR.MESSAGE.JOB_HIDDEN');
			this.smartTableSource.refresh();
		} catch (error) {
			console.log('Error while hiding jobs:', error);
			// Handle and log errors using an error handling service
			this._errorHandlingService.handleError(error);
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

	/**
	 * Handles tab change event.
	 * Resets the form and updates the active tab ID.
	 * @param tab The tab component that triggered the change.
	 */
	onTabChange(tab: NbTabComponent): void {
		this.form.reset();
		this.nbTab$.next(tab.tabId);
	}

	/**
	 * Initiates a job search based on form validity.
	 * Emits a signal to start fetching jobs if the form is valid.
	 */
	searchJobs(): void {
		if (this.form.invalid) {
			return;
		}
		this.jobs$.next(true);
	}

	/**
	 * Handles form submission on Enter key press.
	 * Initiates a job search.
	 */
	handleSubmitOnEnter(): void {
		this.searchJobs();
	}

	/**
	 * Resets the form, clears filters, and refreshes the job list.
	 */
	reset(): void {
		this.form.reset();
		this._filters = {};
		this.refresh();
	}

	/**
	 * Initiates a refresh of job list with updated parameters.
	 * Resets pagination, triggers job fetch, and scrolls to top of page.
	 */
	public refresh(): void {
		this.isRefresh = true;
		this.refreshPagination();
		this.scrollTop();
		this.jobs$.next(true);
	}

	ngOnDestroy(): void {}
}
