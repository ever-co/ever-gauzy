import { Component, OnInit, ViewChild, OnDestroy } from '@angular/core';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { EmployeeSelectorComponent } from '../../../@theme/components/header/selectors/employee/employee.component';
import { Store } from '../../../@core/services/store.service';
import { Proposal, ProposalStatusEnum } from '@gauzy/models';
import { ProposalsService } from '../../../@core/services/proposals.service';
import { NbToastrService } from '@nebular/theme';
import { OrganizationsService } from '../../../@core/services/organizations.service';
import { takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';

@Component({
	selector: 'ga-proposal-register',
	templateUrl: './proposal-register.component.html',
	styleUrls: ['././proposal-register.component.scss']
})
export class ProposalRegisterComponent implements OnInit, OnDestroy {
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
	statuses: string[] = Object.values(ProposalStatusEnum);
	loading = true;
	private _selectedOrganizationId: string;
	private _ngDestroy$ = new Subject<void>();

	ngOnInit() {
		this._initializeForm();

		this.store.selectedOrganization$.subscribe((org) => {
			if (org) {
				this._selectedOrganizationId = org.id;
			}
		});
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
			const result = this.form.value;

			try {
				await this.proposalsService.create({
					employeeId: this.employeeSelector.selectedEmployee.id,
					organizationId: this._selectedOrganizationId,
					jobPostUrl: result.jobPostUrl,
					valueDate: result.valueDate,
					jobPostContent: result.jobPostContent,
					proposalContent: result.proposalContent,
					status: this.statuses[0]
				});

				this.toastrService.primary(
					'New proposal registered',
					'Success'
				);
			} catch (error) {
				this.toastrService.danger(
					error.message || error.message,
					'Error'
				);
			}
		}
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
