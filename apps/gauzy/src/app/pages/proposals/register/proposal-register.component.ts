import { Component, OnInit, ViewChild } from '@angular/core';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { EmployeeSelectorComponent } from '../../../@theme/components/header/selectors/employee/employee.component';
import { Store } from '../../../@core/services/store.service';
import { Proposal } from '@gauzy/models';

@Component({
	selector: 'ga-proposal-register',
	templateUrl: './proposal-register.component.html',
	styleUrls: ['././proposal-register.component.scss']
})
export class ProposalRegisterComponent implements OnInit {
	constructor(private fb: FormBuilder, private store: Store) {}

	@ViewChild('employeeSelector', { static: false })
	employeeSelector: EmployeeSelectorComponent;

	proposal?: Proposal;
	form: FormGroup;

	ngOnInit() {
		this._initializeForm();
	}

	private _initializeForm() {
		this.form = this.fb.group({
			employee: '',
			jobPostUrl: ['', Validators.required],
			valueDate: [new Date(), Validators.required],
			jobPostContent: '',
			proposalContent: ''
		});
	}

	private registerProposal() {}
}
