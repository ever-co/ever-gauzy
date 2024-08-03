import { AfterViewInit, Component, Input, OnDestroy, OnInit, SecurityContext, ViewChild } from '@angular/core';
import { UntypedFormBuilder, FormControl, UntypedFormGroup, FormGroupDirective, Validators } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Subject, Subscription, combineLatest, switchMap, timer } from 'rxjs';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { NbDialogRef } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { CKEditor4, CKEditorComponent } from 'ckeditor4-angular';
import { FileItem, FileUploader, FileUploaderOptions } from 'ng2-file-upload';
import {
	IEmployeeJobApplication,
	IEmployee,
	IEmployeeJobPost,
	IEmployeeProposalTemplate,
	IImageAsset,
	IOrganization,
	ISelectedEmployee,
	IUser,
	JobPostSourceEnum
} from '@gauzy/contracts';
import { environment } from '@gauzy/ui-config';
import { API_PREFIX, Store, distinctUntilChange, isNotEmpty, sleep } from '@gauzy/ui-core/common';
import { ErrorHandlingService, JobService } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { EmployeeSelectorComponent, FormHelpers, ckEditorConfig } from '@gauzy/ui-core/shared';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-apply-job-manually',
	templateUrl: './apply-job-manually.component.html',
	styleUrls: ['./apply-job-manually.component.scss'],
	providers: []
})
export class ApplyJobManuallyComponent extends TranslationBaseComponent implements AfterViewInit, OnInit, OnDestroy {
	public JobPostSourceEnum: typeof JobPostSourceEnum = JobPostSourceEnum;
	public FormHelpers: typeof FormHelpers = FormHelpers;
	public ckConfig: CKEditor4.Config = {
		...ckEditorConfig,
		toolbar: [
			{
				name: 'basicstyles',
				items: [
					'Bold',
					'Italic',
					'Underline',
					'Strike',
					'Subscript',
					'Superscript',
					'-',
					'CopyFormatting',
					'RemoveFormat'
				]
			},
			{
				name: 'clipboard',
				items: ['Cut', 'Copy', 'Paste', 'PasteText', 'PasteFromWord', '-', 'Undo', 'Redo']
			}
		],
		height: '191px' // Set the desired height here
	};
	public organization: IOrganization;
	public uploader: FileUploader;
	public hasDropZoneOver: boolean = false;
	public loading: boolean = false;
	public proposal$: Subject<boolean> = new Subject();
	public proposalTemplate: IEmployeeProposalTemplate;

	/** Apply Job Manually Mutation Form */
	public form: UntypedFormGroup = ApplyJobManuallyComponent.buildForm(this._fb);
	static buildForm(fb: UntypedFormBuilder): UntypedFormGroup {
		return fb.group({
			proposal: [], // Cover Letter
			details: [], // Proposal details
			attachments: [],
			rate: [null, Validators.required], // Hourly Rate
			employeeId: [null, Validators.required]
		});
	}

	/**  Getter and setter for selected Employee */
	_selectedEmployee: ISelectedEmployee;
	get selectedEmployee(): ISelectedEmployee {
		return this._selectedEmployee;
	}
	@Input() set selectedEmployee(selectedEmployee: ISelectedEmployee) {
		this._selectedEmployee = selectedEmployee;
	}

	/**  Getter and setter for selected Job Post */
	_employeeJobPost: IEmployeeJobPost;
	get employeeJobPost(): IEmployeeJobPost {
		return this._employeeJobPost;
	}
	@Input() set employeeJobPost(value: IEmployeeJobPost) {
		this._employeeJobPost = value;
		this.patchFormValue();
	}

	/** Form group directive */
	@ViewChild('formDirective', { static: false }) formDirective: FormGroupDirective;

	/** Ckeditor component */
	@ViewChild('ckeditor') ckeditor: CKEditorComponent;

	/** Employee selector component */
	@ViewChild('employeeSelector') employeeSelector: EmployeeSelectorComponent;

	/**
	 * Newly generate employee job application
	 */
	application$: Subject<IEmployeeJobApplication> = new Subject();

	// After get AI generated proposal successfully
	private retryUntil$: Subscription;

	constructor(
		readonly _translateService: TranslateService,
		private readonly _fb: UntypedFormBuilder,
		private readonly _sanitizer: DomSanitizer,
		private readonly _dialogRef: NbDialogRef<ApplyJobManuallyComponent>,
		private readonly _store: Store,
		private readonly _jobService: JobService,
		private readonly _errorHandlingService: ErrorHandlingService
	) {
		super(_translateService);
	}

	ngOnInit(): void {
		const storeOrganization$ = this._store.selectedOrganization$;
		const storeEmployee$ = this._store.selectedEmployee$;

		combineLatest([storeOrganization$, storeEmployee$])
			.pipe(
				debounceTime(100),
				distinctUntilChange(),
				filter(([organization]) => !!organization),
				tap(([organization, employee]) => {
					this.organization = organization;
					this.selectedEmployee = employee && employee.id ? employee : null;
				}),
				tap(() => this.employeeSelector.selectEmployeeById(this.selectedEmployee?.id)),
				untilDestroyed(this)
			)
			.subscribe();
		this._store.user$
			.pipe(
				filter((user: IUser) => !!user),
				tap(() => this._loadUploaderSettings()),
				untilDestroyed(this)
			)
			.subscribe();
		this.proposal$
			.pipe(
				filter(() => !!this.form.get('employeeId').value),
				tap(() => this.callPreProcessEmployeeJobApplication()),
				untilDestroyed(this)
			)
			.subscribe();
		this.application$
			.pipe(
				tap((application: IEmployeeJobApplication) => this.generateAIProposal(application)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit() {
		this.uploader.onAfterAddingFile = (file) => {
			file.withCredentials = false;
		};
		this.uploader.onSuccessItem = (item: any, response: string, status: number) => {
			try {
				if (response) {
					const image: IImageAsset = JSON.parse(response);
					if (image && image.id) {
						this.form.get('attachments').setValue(image.fullUrl);
						this.form.get('attachments').updateValueAndValidity();
					}
				}
			} catch (error) {
				console.log('Error while uploaded project files', error);
			}
		};
		this.uploader.onErrorItem = (item: any, response: string, status: number) => {
			try {
				if (response) {
					const error = JSON.parse(response);
					console.log('Error while uploaded project files error', error);
					this._errorHandlingService.handleError(error);
				}
			} catch (error) {
				console.log('Error while uploaded project files error', error);
			}
		};
	}

	ngOnDestroy(): void {
		if (this.retryUntil$) {
			this.retryUntil$.unsubscribe();
		}
	}

	/**
	 * Load settings for the file uploader, including headers and additional form data.
	 *
	 * @returns void
	 */
	private _loadUploaderSettings() {
		if (!this._store.user) {
			return;
		}
		const token = this._store.token;
		const tenantId = this._store.user.tenantId;

		const headers: Array<{ name: string; value: string }> = [];
		headers.push({ name: 'Authorization', value: `Bearer ${token}` });
		headers.push({ name: 'Tenant-Id', value: tenantId });

		if (!!this.organization) {
			const { id, tenantId } = this.organization;
			headers.push({ name: 'Organization-Id', value: `${id}` });
			headers.push({ name: 'Tenant-Id', value: `${tenantId}` });
		}

		const uploaderOptions: FileUploaderOptions = {
			url: environment.API_BASE_URL + `${API_PREFIX}/image-assets/upload/proposal_attachments`,
			method: 'POST', // XHR request method
			autoUpload: true, // Upload files automatically upon addition to upload queue
			isHTML5: true, // Use xhrTransport in favor of iframeTransport
			removeAfterUpload: true, // Calculate progress independently for each uploaded file
			headers: headers // XHR request headers
		};
		this.uploader = new FileUploader(uploaderOptions);

		// Adding additional form data
		this.uploader.onBuildItemForm = (fileItem: FileItem, form) => {
			if (!!this._store.user.tenantId) {
				form.append('tenantId', tenantId);
			}

			if (!!this.organization) {
				const { id, tenantId } = this.organization;
				form.append('organizationId', id);
				form.append('tenantId', tenantId);
			}
		};
	}

	/**
	 * File over base
	 * @param e
	 */
	public fileOverBase(e: any): void {
		this.hasDropZoneOver = e;
	}

	/**
	 * Patch job provider details after load page
	 */
	patchFormValue() {
		if (this.employeeJobPost) {
			const { providerCode, employee } = this.employeeJobPost;
			this.setDefaultEmployee(employee);

			const proposal = <FormControl>this.form.get('proposal');
			const details = <FormControl>this.form.get('details');

			/** Cover Letter required if job provider is Upwork */
			if (providerCode === JobPostSourceEnum.UPWORK) {
				proposal.setValidators([Validators.required]);
				details.setValidators(null);
			} else {
				proposal.setValidators(null);
				details.setValidators([Validators.required]);
			}
			this.form.updateValueAndValidity();
		}
	}

	/**
	 * On Proposal template change
	 *
	 * @param item
	 */
	onProposalTemplateChange(item: IEmployeeProposalTemplate | null): void {
		/** Generate proposal using GauzyAI */
		this.proposalTemplate = item || null;

		/** Patch proposal value inside form directive */
		this.form.patchValue({
			proposal: this.proposalTemplate?.content || null,
			details: this.proposalTemplate?.content || null
		});
	}

	/**
	 * On submit job proposal details
	 */
	onSubmit() {
		if (this.form.invalid) {
			return;
		}
		const { employeeId, proposal, rate, details, attachments } = this.form.value;
		const { providerCode, providerJobId } = this.employeeJobPost;

		/** Apply job post input */
		const applyJobPost: IEmployeeJobApplication = {
			applied: true,
			employeeId,
			proposal,
			rate,
			details,
			attachments,
			providerCode,
			providerJobId
		};
		try {
			this._dialogRef.close(applyJobPost);
		} catch (error) {
			console.log('Error while applying job post', error);
			this._errorHandlingService.handleError(error);
		}
	}

	/** Set default employee for job apply */
	setDefaultEmployee(employee: ISelectedEmployee | IEmployee) {
		if (isNotEmpty(employee) && this.form.get('employeeId')) {
			this.form.get('employeeId').setValue(employee.id);
			this.form.get('employeeId').updateValueAndValidity();

			this.setDefaultEmployeeRates(employee);
		}
	}

	/** Set default employee rates */
	setDefaultEmployeeRates(employee: ISelectedEmployee | IEmployee) {
		if (employee) {
			this.form.get('rate').setValue(employee?.billRateValue);
			this.form.get('rate').updateValueAndValidity();
		}
	}

	/** Create employee job application record. */

	private async callPreProcessEmployeeJobApplication() {
		/** Generate job application record for employee */
		const employeeId = this.form.get('employeeId').value;
		if (!employeeId) {
			return;
		}

		const rate = this.form.get('rate').value;

		const proposalTemplate = this.proposalTemplate?.content || null;
		const jobPost = this.employeeJobPost.jobPost;
		const { id: employeeJobPostId, isActive, isArchived } = this.employeeJobPost;

		try {
			/** Generate employee job application request parameters */
			const generateProposalRequest = {
				employeeId: employeeId,
				proposalTemplate: proposalTemplate,
				employeeJobPostId: employeeJobPostId,
				jobPostId: jobPost.id,
				jobPost: jobPost,
				providerCode: jobPost.providerCode,
				providerJobId: jobPost.providerJobId,
				isProposalGeneratedByAI: true,
				jobStatus: jobPost.jobStatus,
				jobType: jobPost.jobType,
				jobDateCreated: jobPost.jobDateCreated,
				rate: rate,
				isActive: isActive,
				isArchived: isArchived,
				attachments: '{}',
				qa: '{}',
				terms: '{}'
			};

			this.loading = true;

			// Send the employee job application
			const application = await this._jobService.preProcessEmployeeJobApplication(generateProposalRequest);

			// send the employee job application
			this.application$.next(application);
		} catch (error) {
			console.error('Error while creating employee job application', error);
		}
	}

	/**
	 * Generate AI proposal for employee job application
	 *
	 * @param application
	 */
	public async generateAIProposal(employeeJobApplication: IEmployeeJobApplication) {
		try {
			const employeeJobApplicationId = employeeJobApplication.id;
			await this._jobService.generateAIProposal(employeeJobApplicationId);

			// Sleeps for 10 seconds before get proposal.
			const sleepDelay = 10000;
			await sleep(sleepDelay);

			// try to get AI generated proposal for specific employee job application
			await this.getAIGeneratedProposal(employeeJobApplicationId);
		} catch (error) {
			console.error('Error while initiate process for generate AI proposal by employee job application', error);
		}
	}

	/**
	 * Get AI generated proposal for employee job application
	 * Every 3 seconds try to get proposal
	 *
	 * @param employeeJobApplicationId
	 */
	async getAIGeneratedProposal(employeeJobApplicationId: string) {
		if (this.retryUntil$) {
			this.retryUntil$.unsubscribe();
		}
		const retryDelay = 5000; // Delay between retries in milliseconds
		// sleep for every 3 seconds

		const source$ = timer(0, retryDelay);
		this.retryUntil$ = source$
			.pipe(
				filter(() => !!employeeJobApplicationId),
				switchMap(() => this._jobService.getEmployeeJobApplication(employeeJobApplicationId)),
				tap((application) => {
					const { isProposalGeneratedByAI } = application;
					// Stop making API calls as the desired parameter is found
					if (isProposalGeneratedByAI) {
						try {
							/** If employee proposal generated successfully from Gauzy AI */
							if (isNotEmpty(application)) {
								// Replace line breaks with spaces
								const proposal = application.proposal
									.replace(/\n\n/g, '<br/><br>')
									.replace(/\n/g, '<br/>');

								// Set ckeditor html content
								this.ckeditor.instance.document.getBody().setHtml(proposal);

								/** Patch proposal value inside form directive */
								this.form.patchValue({
									details: proposal,
									proposal: proposal
								});
							} else {
								this.form.patchValue({
									proposal: this.proposalTemplate,
									details: this.proposalTemplate
								});
							}
						} finally {
							this.loading = false;
							this.retryUntil$.unsubscribe();
						}
					}
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Get plain text from proposal
	 *
	 */
	getPlainText(): string {
		const content: SafeHtml = this.ckeditor.instance.getData();
		/**
		 * Create temporary div element
		 */
		const element = document.createElement('div');
		element.innerHTML = this._sanitizer.sanitize(
			SecurityContext.HTML, // Set bypassSecurityTrustHtml to allow the HTML content
			content
		);

		const plainText = element.textContent || element.innerText || '';
		return plainText.trim();
	}

	/**
	 * On editor change
	 */
	onEditorChange(content: string): void {}

	/**
	 * Close dialog
	 */
	close() {
		this._dialogRef.close(false);
	}
}
