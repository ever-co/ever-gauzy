import { Component, Input, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { IEmployeeProposalTemplate } from '@gauzy/models';
import { NbDialogRef } from '@nebular/theme';
import { ToastrService } from 'apps/gauzy/src/app/@core/services/toastr.service';
import { SelectedEmployee } from 'apps/gauzy/src/app/@theme/components/header/selectors/employee/employee.component';
import { ProposalTemplateService } from '../proposal-template.service';

@Component({
	selector: 'ga-add-edit-proposal-template',
	templateUrl: './add-edit-proposal-template.component.html',
	styleUrls: ['./add-edit-proposal-template.component.scss']
})
export class AddEditProposalTemplateComponent implements OnInit {
	mode: 'create' | 'update' = 'create';

	@Input() selectedEmployee: SelectedEmployee;
	@Input() proposalTemplate: IEmployeeProposalTemplate = {};
	form: FormGroup;

	constructor(
		private dialogRef: NbDialogRef<AddEditProposalTemplateComponent>,
		private fb: FormBuilder,
		private proposalTemplateService: ProposalTemplateService,
		private toastrService: ToastrService
	) {}

	ngOnInit(): void {
		if (this.proposalTemplate && this.proposalTemplate.id) {
			this.mode = 'update';
		} else {
			this.mode = 'create';
		}
		this.form = this.fb.group({
			employeeId: [this.proposalTemplate.employeeId || ''],
			name: [this.proposalTemplate.name || ''],
			content: [this.proposalTemplate.content || '']
		});
	}

	close() {
		this.dialogRef.close();
	}

	onSave(): void {
		if (this.form.valid) {
			let resp: Promise<IEmployeeProposalTemplate>;
			const request = this.form.value;
			if (this.selectedEmployee && this.selectedEmployee.id) {
				request.employeeId = this.selectedEmployee.id;
			}
			if (this.mode === 'create') {
				resp = this.proposalTemplateService.create(request);
			} else {
				resp = this.proposalTemplateService.update(
					this.proposalTemplate.id,
					request
				);
			}

			resp.then((data) => {
				this.dialogRef.close(data);
			}).catch((error) => {
				this.toastrService.error(error);
			});
		}
	}
}
