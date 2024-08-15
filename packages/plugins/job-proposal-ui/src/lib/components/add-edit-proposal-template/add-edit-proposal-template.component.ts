import { Component, Input, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { IEmployeeProposalTemplate, IOrganization, ISelectedEmployee } from '@gauzy/contracts';
import { NbDialogRef } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { filter, tap } from 'rxjs/operators';
import { CKEditor4 } from 'ckeditor4-angular/ckeditor';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { distinctUntilChange } from '@gauzy/ui-core/common';
import { ErrorHandlingService, ProposalTemplateService, Store, ToastrService } from '@gauzy/ui-core/core';
import { ckEditorConfig } from '@gauzy/ui-core/shared';

@UntilDestroy()
@Component({
	selector: 'ga-add-edit-proposal-template',
	templateUrl: './add-edit-proposal-template.component.html',
	styleUrls: ['./add-edit-proposal-template.component.scss']
})
export class AddEditProposalTemplateComponent extends TranslationBaseComponent implements OnInit {
	public organization: IOrganization;
	public ckConfig: CKEditor4.Config = ckEditorConfig;

	public form: UntypedFormGroup = AddEditProposalTemplateComponent.buildForm(this._fb);
	static buildForm(fb: UntypedFormBuilder): UntypedFormGroup {
		return fb.group({
			employeeId: [null, Validators.required],
			name: [null, Validators.required],
			content: []
		});
	}

	/*
	 * Getter & Setter for proposal template selected employee
	 */
	_selectedEmployee: ISelectedEmployee;
	get selectedEmployee(): ISelectedEmployee {
		return this._selectedEmployee;
	}
	@Input() set selectedEmployee(employee: ISelectedEmployee) {
		this._selectedEmployee = employee;
		/**
		 * Set default select employee
		 */
		if (employee?.id && this.form.get('employeeId')) {
			this.form.get('employeeId').setValue(employee.id);
			this.form.get('employeeId').updateValueAndValidity();
		}
	}

	/*
	 * Getter & Setter for selected proposal template
	 */
	_proposalTemplate: IEmployeeProposalTemplate;
	get proposalTemplate(): IEmployeeProposalTemplate {
		return this._proposalTemplate;
	}
	@Input() set proposalTemplate(value: IEmployeeProposalTemplate) {
		this._proposalTemplate = value;
	}

	constructor(
		translateService: TranslateService,
		private readonly _dialogRef: NbDialogRef<AddEditProposalTemplateComponent>,
		private readonly _fb: UntypedFormBuilder,
		private readonly _proposalTemplateService: ProposalTemplateService,
		private readonly _toastrService: ToastrService,
		private readonly _store: Store,
		private readonly _errorHandlingService: ErrorHandlingService
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this._store.selectedOrganization$
			.pipe(
				distinctUntilChange(),
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => (this.organization = organization)),
				tap(() => this._setFormValues()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Set form values based on the selected proposal template.
	 */
	private _setFormValues(): void {
		if (!this.proposalTemplate) return;

		const { employeeId, name, content } = this.proposalTemplate;
		this.form.patchValue({ employeeId, name, content });
		this.form.updateValueAndValidity();
	}

	/**
	 * Close the dialog.
	 */
	close() {
		this._dialogRef.close();
	}

	/**
	 * Saves the proposal template.
	 * @returns {Promise<void>}
	 */
	async onSave(): Promise<void> {
		if (!this.organization || this.form.invalid) return;

		// Get the organization and tenant ID
		const { id: organizationId, tenantId } = this.organization;

		// Create a new object with the form values
		const request = {
			organizationId,
			tenantId,
			// Only include employeeId if creating a new proposal template
			...(this.proposalTemplate ? {} : { employeeId: this.selectedEmployee?.id ?? this.form.value.employeeId }),
			...this.form.value
		};

		try {
			// Call the create or update method of the proposalTemplateService
			const data = !this.proposalTemplate
				? await this._proposalTemplateService.create(request)
				: await this._proposalTemplateService.update(this.proposalTemplate.id, request);

			this._dialogRef.close(data);

			const messageKey = !this.proposalTemplate
				? 'PROPOSAL_TEMPLATE.PROPOSAL_CREATE_MESSAGE'
				: 'PROPOSAL_TEMPLATE.PROPOSAL_EDIT_MESSAGE';

			this._toastrService.success(messageKey, { name: request.name });
		} catch (error) {
			console.log('Error while saving proposal template', error);
			this._errorHandlingService.handleError(error);
		}
	}
}
