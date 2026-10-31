import { Component, OnInit, ViewChild, Input, ChangeDetectionStrategy } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { NbDateService, NbDialogRef } from '@nebular/theme';
import {
	IEmployee,
	ITimeOffPolicy,
	ITimeOff,
	IOrganization,
	StatusTypesEnum,
	IImageAsset as IDocumentAsset,
	TIME_OFF_REQUEST_FORM_DOCUMENT_NAMES,
	TimeOffRequestFormTypeEnum
} from '@gauzy/contracts';
import { firstValueFrom } from 'rxjs';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { CompareDateValidator, OrganizationDocumentsService, Store, ToastrService } from '@gauzy/ui-core/core';
import { distinctUntilChange, downloadFile, toHttpUrl } from '@gauzy/ui-core/common';
import { EmployeeSelectorComponent } from '../../selectors/employee/employee.component';
import { FormHelpers } from '../../forms/helpers';
import { findTimeOffRequestForm } from './time-off-request-form';

@UntilDestroy({ checkProperties: true })
@Component({
    selector: 'ngx-time-off-request-mutation',
    templateUrl: './time-off-request-mutation.component.html',
    styleUrls: ['../time-off-mutation.components.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class TimeOffRequestMutationComponent implements OnInit {
	FormHelpers: typeof FormHelpers = FormHelpers;
	readonly RequestFormType = TimeOffRequestFormTypeEnum;

	/** The request form the browser would not open in a new tab, offered as a link the user clicks instead. */
	blockedRequestForm: { name: string; url: string } | null = null;

	/**
	 * Employee Selector
	 */
	employeeSelector: EmployeeSelectorComponent;
	@ViewChild('employeeSelector', { static: false }) set content(component: EmployeeSelectorComponent) {
		if (component) {
			this.employeeSelector = component;
		}
	}

	@Input() type: string;

	/*
	 * Getter & Setter
	 */
	_timeOff: ITimeOff;
	get timeOff(): ITimeOff {
		return this._timeOff;
	}
	@Input() set timeOff(value: ITimeOff) {
		this._timeOff = value;
	}

	employeesArr: IEmployee[] = [];
	selectedEmployee: any;
	isEditMode = false;
	minDate: Date;
	public organization: IOrganization;

	/*
	 * Time Off Request Mutation Form
	 */
	public form: UntypedFormGroup = TimeOffRequestMutationComponent.buildForm(this.fb);
	static buildForm(fb: UntypedFormBuilder): UntypedFormGroup {
		const form = fb.group(
			{
				start: [null, Validators.required],
				end: [null, Validators.required],
				policy: [null, Validators.required],
				policyId: [null, Validators.required],
				documentUrl: [null],
				documentId: [],
				status: [],
				description: []
			},
			{
				validators: [CompareDateValidator.validateDate('start', 'end')]
			}
		);
		return form;
	}

	constructor(
		protected readonly dialogRef: NbDialogRef<TimeOffRequestMutationComponent>,
		private readonly fb: UntypedFormBuilder,
		private readonly documentsService: OrganizationDocumentsService,
		private readonly store: Store,
		private readonly dateService: NbDateService<Date>,
		private readonly toastrService: ToastrService
	) {
		this.minDate = this.dateService.addMonth(this.dateService.today(), 0);
	}

	ngOnInit() {
		this.store.selectedOrganization$
			.pipe(
				debounceTime(200),
				distinctUntilChange(),
				filter((organization: IOrganization) => !!organization),
				tap((organization) => (this.organization = organization)),
				tap(() => this.patchFormValue()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Upload document asset
	 *
	 * @param image
	 */
	uploadDocumentAsset(document: IDocumentAsset) {
		try {
			this.form.get('documentId').setValue(document.id);
			this.form.get('documentUrl').setValue(document.fullUrl);
			this.form.updateValueAndValidity();
		} catch (error) {
			console.log('Error while uploading document asset', error);
		}
	}

	/**
	 * Upload document asset URL
	 *
	 * @param image
	 */
	uploadDocumentAssetUrl(documentUrl: IDocumentAsset['fullUrl']) {
		try {
			const previousDocumentUrl = this.form.get('documentUrl').value;
			const nextDocumentUrl = documentUrl || null;
			this.form.get('documentUrl').setValue(nextDocumentUrl);
			// A cleared or different URL no longer names the uploaded asset, so drop its id too
			if (!nextDocumentUrl || previousDocumentUrl !== nextDocumentUrl) {
				this.form.get('documentId').setValue(null);
			}
		} catch (error) {
			console.log('Error while uploading document asset', error);
		}
	}

	/**
	 * Patch form value on edit section
	 */
	patchFormValue() {
		// patch form value
		if (this.timeOff) {
			this.form.patchValue({
				start: this.timeOff.start,
				end: this.timeOff.end,
				description: this.timeOff.description,
				policy: this.timeOff.policy,
				policyId: this.timeOff.policyId,
				status: this.timeOff.status,
				documentUrl: this.timeOff.documentUrl,
				documentId: this.timeOff.documentId
			});

			this.selectedEmployee = this.timeOff['employees'][0];
			this.employeesArr = this.timeOff['employees'];
		}
	}

	saveRequest() {
		this.selectedEmployee = this.employeeSelector.selectedEmployee;
		if (this.selectedEmployee?.id) {
			// The selector shows the request's first employee: replace that one, keep the others of a shared request
			const [, ...others] = this.timeOff?.employees ?? [];
			this.employeesArr = [this.selectedEmployee, ...others.filter(({ id }) => id !== this.selectedEmployee.id)];
			this._createNewRecord();
		}
	}

	/**
	 * Downloads the organization's paid or unpaid request form (issue #5481). The form is the organization
	 * document named as in `TIME_OFF_REQUEST_FORM_DOCUMENT_NAMES`, whatever its place in the list; when there is
	 * none, or its link does not give a file, a hint says so instead of opening another document. When the browser
	 * blocks the tab the form would open in, the dialog shows a link to it.
	 *
	 * @param type Which form.
	 */
	async getRequestForm(type: TimeOffRequestFormTypeEnum): Promise<void> {
		if (!this.organization) {
			return;
		}
		this.blockedRequestForm = null;
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		try {
			const { items } = await firstValueFrom(this.documentsService.getAll({ tenantId, organizationId }));
			const form = findTimeOffRequestForm(items, type);
			if (!form) {
				this.toastrService.warning('TIME_OFF_PAGE.REQUEST_FORM_NOT_FOUND', {
					name: TIME_OFF_REQUEST_FORM_DOCUMENT_NAMES[type]
				});
				return;
			}

			const result = await downloadFile(form.documentUrl, form.name);
			if (result === 'invalid' || result === 'unavailable') {
				this.toastrService.warning('TIME_OFF_PAGE.REQUEST_FORM_UNAVAILABLE', { name: form.name });
			} else if (result === 'blocked') {
				this.blockedRequestForm = { name: form.name, url: toHttpUrl(form.documentUrl).href };
				this.toastrService.warning('TIME_OFF_PAGE.REQUEST_FORM_BLOCKED', { name: form.name });
			}
		} catch (error) {
			this.toastrService.danger(error);
		}
	}

	private _createNewRecord() {
		if (this.form.invalid) {
			return;
		}
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		this.dialogRef.close(
			Object.assign(
				{
					employees: this.employeesArr,
					organizationId,
					tenantId,
					isHoliday: false,
					requestDate: new Date()
				},
				this.form.value
			)
		);
	}

	/**
	 * On Policy Selection
	 *
	 * @param policy
	 */
	onPolicySelected(policy: ITimeOffPolicy) {
		this.form.get('policy').setValue(policy);
		if (policy.requiresApproval) {
			this.form.get('status').setValue(StatusTypesEnum.REQUESTED);
		} else {
			this.form.get('status').setValue(StatusTypesEnum.APPROVED);
		}
		this.form.updateValueAndValidity();
	}

	close() {
		this.dialogRef.close();
	}
}
