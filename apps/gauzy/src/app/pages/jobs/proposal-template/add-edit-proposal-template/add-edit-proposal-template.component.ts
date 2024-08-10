import { Component, Input, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { IEmployeeProposalTemplate, IOrganization, ISelectedEmployee } from '@gauzy/contracts';
import { NbDialogRef } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { filter, tap } from 'rxjs/operators';
import { CKEditor4 } from 'ckeditor4-angular/ckeditor';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { Store, distinctUntilChange, isNotEmpty } from '@gauzy/ui-core/common';
import { ckEditorConfig } from '@gauzy/ui-core/shared';
import { ProposalTemplateService, ToastrService } from '@gauzy/ui-core/core';

@UntilDestroy()
@Component({
	selector: 'ga-add-edit-proposal-template',
	templateUrl: './add-edit-proposal-template.component.html',
	styleUrls: ['./add-edit-proposal-template.component.scss']
})
export class AddEditProposalTemplateComponent extends TranslationBaseComponent implements OnInit {
	public organization: IOrganization;
	public ckConfig: CKEditor4.Config = ckEditorConfig;

	public form: UntypedFormGroup = AddEditProposalTemplateComponent.buildForm(this.fb);
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
	@Input() set selectedEmployee(value: ISelectedEmployee) {
		this._selectedEmployee = value;
		/**
		 * Set default select employee
		 */
		if (isNotEmpty(value) && this.form.get('employeeId')) {
			this.form.get('employeeId').setValue(value.id);
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
		private readonly dialogRef: NbDialogRef<AddEditProposalTemplateComponent>,
		private readonly fb: UntypedFormBuilder,
		private readonly proposalTemplateService: ProposalTemplateService,
		private readonly toastrService: ToastrService,
		private readonly store: Store,
		readonly translate: TranslateService
	) {
		super(translate);
	}

	ngOnInit(): void {
		this.store.selectedOrganization$
			.pipe(
				distinctUntilChange(),
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => (this.organization = organization)),
				tap(() => this._setFormValues()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	private _setFormValues() {
		if (isNotEmpty(this.proposalTemplate)) {
			const { employeeId, name, content } = this.proposalTemplate;
			this.form.patchValue({
				employeeId,
				name,
				content
			});
			this.form.updateValueAndValidity();
		}
	}

	close() {
		this.dialogRef.close();
	}

	onSave(): void {
		if (!this.organization || this.form.invalid) {
			return;
		}
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		let resp: Promise<IEmployeeProposalTemplate>;
		const template = {
			...this.form.getRawValue(),
			organizationId,
			tenantId
		};
		if (this.selectedEmployee && this.selectedEmployee.id) {
			template.employeeId = this.selectedEmployee.id;
		}
		if (!this.proposalTemplate) {
			resp = this.proposalTemplateService.create(template);
		} else {
			resp = this.proposalTemplateService.update(this.proposalTemplate.id, {
				...template,
				employeeId: this.proposalTemplate.employeeId
			});
		}

		resp.then((data) => {
			this.dialogRef.close(data);
			if (!this.proposalTemplate) {
				this.toastrService.success('PROPOSAL_TEMPLATE.PROPOSAL_CREATE_MESSAGE', {
					name: template.name
				});
			} else {
				this.toastrService.success('PROPOSAL_TEMPLATE.PROPOSAL_EDIT_MESSAGE', {
					name: template.name
				});
			}
		}).catch((error) => {
			this.toastrService.error(error);
		});
	}
}
