import { Component, OnInit, ViewChild } from '@angular/core';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { EmployeeSelectorComponent } from '../../../@theme/components/header/selectors/employee/employee.component';
import { Store } from '../../../@core/services/store.service';
import { Proposal } from '@gauzy/models';
import { ProposalsService } from '../../../@core/services/proposals.service';
import { NbToastrService } from '@nebular/theme';

@Component({
	selector: 'ga-proposal-register',
	templateUrl: './proposal-register.component.html',
	styleUrls: ['././proposal-register.component.scss']
})
export class ProposalRegisterComponent implements OnInit {
	constructor(
		private fb: FormBuilder,
		private store: Store,
		private proposalsService: ProposalsService,
		private toastrService: NbToastrService
	) {}

	@ViewChild('employeeSelector', { static: false })
	employeeSelector: EmployeeSelectorComponent;
	proposal?: Proposal;
	form: FormGroup;
	employeeName: string;
	loading = true;

	ngOnInit() {
		this._initializeForm();
	}

	private _initializeForm() {
		this.form = this.fb.group({
			jobPostUrl: ['', Validators.required],
			valueDate: [new Date(), Validators.required],
			jobPostContent: '',
			proposalContent: ''
		});
	}

	private async registerProposal() {
		if (this.form.valid) {
			const result = Object.assign(
				{ employee: this.employeeSelector.selectedEmployee },
				this.form.value
			);

			try {
				await this.proposalsService.create({
					employeeId: result.employee.id,
					jobPostUrl: result.jobPostUrl,
					valueDate: result.valueDate,
					jobPostContent: result.jobPostContent,
					proposalContent: result.proposalContent
				});

				this.toastrService.primary(
					'New proposal registered',
					'Success'
				);
			} catch (error) {
				this.toastrService.danger(
					error.error.message || error.message,
					'Error'
				);
			}
		}
	}
}
