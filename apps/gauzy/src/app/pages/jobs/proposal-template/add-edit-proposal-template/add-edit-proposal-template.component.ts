import { Component, Input, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import {
	IEmployeeProposalTemplate,
	IOrganization,
	ISelectedEmployee
} from '@gauzy/contracts';
import { NbDialogRef } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { filter, tap } from 'rxjs/operators';
import { Store, ToastrService } from './../../../../@core/services';
import { TranslationBaseComponent } from './../../../../@shared/language-base/translation-base.component';
import { ProposalTemplateService } from '../proposal-template.service';

@UntilDestroy()
@Component({
	selector: 'ga-add-edit-proposal-template',
	templateUrl: './add-edit-proposal-template.component.html',
	styleUrls: ['./add-edit-proposal-template.component.scss']
})
export class AddEditProposalTemplateComponent
	extends TranslationBaseComponent
	implements OnInit {
	mode: 'create' | 'update' = 'create';

	@Input() selectedEmployee: ISelectedEmployee;
	@Input() proposalTemplate: IEmployeeProposalTemplate = {};

	organization: IOrganization;
	public ckConfig: any = {
		width: '100%',
		height: '320',
    toolbar: [
      { name: 'document', items: [ 'Source', '-', 'Save', 'NewPage', 'ExportPdf', 'Preview', 'Print', '-', 'Templates' ] },
      { name: 'clipboard', items: [ 'Cut', 'Copy', 'Paste', 'PasteText', 'PasteFromWord', '-', 'Undo', 'Redo' ] },
      { name: 'editing', items: [ 'Find', 'Replace', '-', 'SelectAll', '-', 'Scayt' ] },
      { name: 'forms', items: [ 'Form', 'Checkbox', 'Radio', 'TextField', 'Textarea', 'Select', 'Button', 'ImageButton', 'HiddenField' ] },
      '/',
      { name: 'basicstyles', items: [ 'Bold', 'Italic', 'Underline', 'Strike', 'Subscript', 'Superscript', '-', 'CopyFormatting', 'RemoveFormat' ] }
    ],
    toolbarCanCollapse: true
	};

	public form: FormGroup = AddEditProposalTemplateComponent.buildForm(this.fb);
	static buildForm(fb: FormBuilder): FormGroup {
		return fb.group({
			employeeId: [],
			name: [],
			content: []
		});
	}

	constructor(
		private dialogRef: NbDialogRef<AddEditProposalTemplateComponent>,
		private fb: FormBuilder,
		private proposalTemplateService: ProposalTemplateService,
		private toastrService: ToastrService,
		private store: Store,
		readonly translate: TranslateService
	) {
		super(translate);
	}

	ngOnInit(): void {
		if (this.proposalTemplate.id) {
			this.mode = 'update';
		} else {
			this.mode = 'create';
		}
		this.store.selectedOrganization$
			.pipe(
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => this.organization = organization),
				tap(() => this._initializeForm()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	private _initializeForm() {
		if (this.proposalTemplate) {
			const { employeeId, name, content } = this.proposalTemplate;
			this.form.patchValue({
				employeeId,
				name,
				content
			});
		}
	}

	close() {
		this.dialogRef.close();
	}

	onSave(): void {
		if (this.form.invalid) {
			return;
		}
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		let resp: Promise<IEmployeeProposalTemplate>;
		const request = {
			...this.form.value,
			organizationId,
			tenantId
		};
		if (this.selectedEmployee && this.selectedEmployee.id) {
			request.employeeId = this.selectedEmployee.id;
		}
		if (this.mode === 'create') {
			resp = this.proposalTemplateService.create(request);
		} else {
			resp = this.proposalTemplateService.update(
				this.proposalTemplate.id,
				{
					...request,
					employeeId: this.proposalTemplate.employeeId
				}
			);
		}

		resp.then((data) => {
			this.dialogRef.close(data);
			if (this.mode === 'create') {
				this.toastrService.success(
					'PROPOSAL_TEMPLATE.PROPOSAL_CREATE_MESSAGE',
					{
						name: request.name
					}
				);
			} else {
				this.toastrService.success(
					'PROPOSAL_TEMPLATE.PROPOSAL_EDIT_MESSAGE',
					{
						name: request.name
					}
				);
			}
		}).catch((error) => {
			this.toastrService.error(error);
		});
	}
}
