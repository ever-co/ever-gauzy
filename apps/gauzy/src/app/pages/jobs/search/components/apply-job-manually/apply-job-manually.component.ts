import { AfterViewInit, Component, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, FormGroupDirective, Validators } from '@angular/forms';
import { combineLatest } from 'rxjs';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { NbDialogRef } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { CKEditor4 } from 'ckeditor4-angular';
import { FileUploader, FileUploaderOptions } from 'ng2-file-upload';
import {
	IApplyJobPostInput,
	IEmployeeJobPost,
	IEmployeeProposalTemplate,
	IImageAsset,
	IOrganization,
	ISelectedEmployee,
	IUser,
	JobPostSourceEnum
} from '@gauzy/contracts';
import { distinctUntilChange, isNotEmpty } from '@gauzy/common-angular';
import { Store, ToastrService } from './../../../../../@core/services';
import { API_PREFIX } from './../../../../../@core/constants';
import { FormHelpers } from './../../../../../@shared/forms';
import { TranslationBaseComponent } from './../../../../../@shared/language-base';
import { ckEditorConfig } from './../../../../../@shared/ckeditor.config';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-apply-job-manually',
	templateUrl: './apply-job-manually.component.html',
	styleUrls: ['./apply-job-manually.component.scss']
})
export class ApplyJobManuallyComponent extends TranslationBaseComponent implements AfterViewInit, OnInit, OnDestroy {
	public JobPostSourceEnum: typeof JobPostSourceEnum = JobPostSourceEnum;
	public FormHelpers: typeof FormHelpers = FormHelpers;
	public ckConfig: CKEditor4.Config = ckEditorConfig;
	public organization: IOrganization;
	public uploader: FileUploader;
	public hasDropZoneOver: boolean = false;

	/** Apply Job Manually Form */
	public form: FormGroup = ApplyJobManuallyComponent.buildForm(this.fb);
	static buildForm(fb: FormBuilder): FormGroup {
		return fb.group({
			proposal: [], // Cover Letter
			details: [], // Proposal details
			attachments: [],
			rate: [null, Validators.required], // Hourly Rate
			employeeId: [null, Validators.required]
		});
	}

	/**  Getter & Setter for Selected Employee */
	_selectedEmployee: ISelectedEmployee;
	get selectedEmployee(): ISelectedEmployee {
		return this._selectedEmployee;
	}
	@Input() set selectedEmployee(employee: ISelectedEmployee) {
		this._selectedEmployee = employee;
		/** Set default select employee */
		if (isNotEmpty(employee) && this.form.get('employeeId')) {
			this.form.get('employeeId').setValue(employee.id);
			this.form.get('employeeId').updateValueAndValidity();

			this.setDefaultEmployeeRates(employee);
		}
	}

	/**  Getter & Setter for Job Post */
	_jobPost: IEmployeeJobPost;
	get jobPost(): IEmployeeJobPost {
		return this._jobPost;
	}
	@Input() set jobPost(jobPost: IEmployeeJobPost) {
		this._jobPost = jobPost;
		this.patchFormValue();
	}

	/** Form group directive */
	@ViewChild('formDirective') formDirective: FormGroupDirective;

	constructor(
		private readonly fb: FormBuilder,
		private readonly dialogRef: NbDialogRef<ApplyJobManuallyComponent>,
		public readonly translateService: TranslateService,
		private readonly store: Store,
		private readonly toastrService: ToastrService
	) {
		super(translateService);
	}

	ngOnInit(): void {
		const storeUser$ = this.store.user$;
		const storeOrganization$ = this.store.selectedOrganization$;
		const storeEmployee$ = this.store.selectedEmployee$;
		combineLatest([storeOrganization$, storeEmployee$])
			.pipe(
				debounceTime(100),
				distinctUntilChange(),
				filter(([organization]) => !!organization),
				tap(([organization, employee]) => {
					this.organization = organization;
					this.selectedEmployee = employee && employee.id ? employee : null;
				}),
				untilDestroyed(this)
			)
			.subscribe();
		storeUser$
			.pipe(
				filter((user: IUser) => !!user),
				tap(() => this._loadUploaderSettings()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit() {
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
					this.toastrService.danger(error);
				}
			} catch (error) {
				console.log('Error while uploaded project files error', error);
			}
		};
	}

	ngOnDestroy(): void {}

	private _loadUploaderSettings() {
		if (!this.store.user) {
			return;
		}
		const { token } = this.store;
		const { tenantId } = this.store.user;

		const headers: Array<{ name: string; value: string }> = [];
		headers.push({ name: 'Authorization', value: `Bearer ${token}` });
		headers.push({ name: 'Tenant-Id', value: tenantId });

		const uploaderOptions: FileUploaderOptions = {
			url: `${API_PREFIX}/image-assets/upload/proposal_attachments`,
			// XHR request method
			method: 'POST',
			// Upload files automatically upon addition to upload queue
			autoUpload: true,
			// Use xhrTransport in favor of iframeTransport
			isHTML5: true,
			// Calculate progress independently for each uploaded file
			removeAfterUpload: true,
			// XHR request headers
			headers: headers
		};
		this.uploader = new FileUploader(uploaderOptions);
	}

	public fileOverBase(e: any): void {
		this.hasDropZoneOver = e;
	}

	/**
	 * Patch job provider details after load page
	 */
	patchFormValue() {
		if (this.jobPost) {
			const { providerCode } = this.jobPost;

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
		if (isNotEmpty(item)) {
			const { content } = item;
			this.form.patchValue({ details: content, proposal: content });
		} else {
			this.form.patchValue({ proposal: null, details: null });
		}
	}

	/**
	 * On submit job proposal details
	 */
	onSubmit() {
		if (this.form.invalid) {
			return;
		}
		const { employeeId, proposal, rate, details, attachments } = this.form.value;
		const { providerCode, providerJobId } = this.jobPost;

		/** Apply job post input */
		const applyJobPost: IApplyJobPostInput = {
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
			this.dialogRef.close(applyJobPost);
		} catch (error) {
			console.log('Error while applying job post', error);
		}
	}

	/** Set default employee rates */
	setDefaultEmployeeRates(employee: ISelectedEmployee) {
		if (employee && employee.billRateValue) {
			this.form.get('rate').setValue(employee.billRateValue);
			this.form.get('rate').updateValueAndValidity();
		}
	}

	/**
	 * Close dialog
	 */
	close() {
		this.dialogRef.close(false);
	}
}
