import { Component, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, FormGroupDirective, Validators } from '@angular/forms';
import { combineLatest } from 'rxjs';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { NbDialogRef } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { CKEditor4 } from 'ckeditor4-angular';
import { IApplyJobPostInput, IEmployeeJobPost, IOrganization, ISelectedEmployee, JobPostSourceEnum } from '@gauzy/contracts';
import { distinctUntilChange, isNotEmpty } from '@gauzy/common-angular';
import { Store } from './../../../../../@core/services';
import { FormHelpers } from './../../../../../@shared/forms';
import { TranslationBaseComponent } from './../../../../../@shared/language-base';
import { ckEditorConfig } from './../../../../../@shared/ckeditor.config';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-apply-job-manually',
	templateUrl: './apply-job-manually.component.html',
	styleUrls: ['./apply-job-manually.component.scss']
})
export class ApplyJobManuallyComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {

	public JobPostSourceEnum: typeof JobPostSourceEnum = JobPostSourceEnum;
	public FormHelpers: typeof FormHelpers = FormHelpers;
	public ckConfig: CKEditor4.Config = ckEditorConfig;
	public organization: IOrganization;

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
	_selectedEmployeeId: ISelectedEmployee['id'];
	get selectedEmployeeId(): ISelectedEmployee['id'] {
		return this._selectedEmployeeId;
	}
	@Input() set selectedEmployeeId(employeeId: ISelectedEmployee['id']) {
		this._selectedEmployeeId = employeeId;
		/** Set default select employee */
		if (isNotEmpty(employeeId) && this.form.get('employeeId')) {
			this.form.get('employeeId').setValue(employeeId);
			this.form.get('employeeId').updateValueAndValidity();
		}
	}

	/**  Getter & Setter for Job Post */
	_jobPost: IEmployeeJobPost;
	get jobPost(): IEmployeeJobPost {
		return this._jobPost;
	}
	@Input() set jobPost(value: IEmployeeJobPost) {
		this._jobPost = value;
		this.patchFormValue();
	}

	/** Form group directive */
	@ViewChild('formDirective') formDirective: FormGroupDirective;

	constructor(
		private readonly fb: FormBuilder,
		private readonly dialogRef: NbDialogRef<ApplyJobManuallyComponent>,
		public readonly translateService: TranslateService,
		private readonly store: Store
	) {
		super(translateService);
	}

	ngOnInit(): void {
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
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngOnDestroy(): void { }

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

	/**
	 * Close dialog
	 */
	close() {
		this.dialogRef.close(false);
	}
}
