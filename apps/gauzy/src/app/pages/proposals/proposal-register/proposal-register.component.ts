import { Component, OnInit, ViewChild, OnDestroy } from '@angular/core';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { EmployeeSelectorComponent } from '../../../@theme/components/header/selectors/employee/employee.component';
import { Store } from '../../../@core/services/store.service';
import { Proposal, ProposalStatusEnum, Tag } from '@gauzy/models';
import { ProposalsService } from '../../../@core/services/proposals.service';
import { NbToastrService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { Subject } from 'rxjs';
import { Router } from '@angular/router';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';

@Component({
	selector: 'ga-proposal-register',
	templateUrl: './proposal-register.component.html',
	styleUrls: ['././proposal-register.component.scss']
})
export class ProposalRegisterComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	constructor(
		private fb: FormBuilder,
		private store: Store,
		private router: Router,
		private proposalsService: ProposalsService,
		private toastrService: NbToastrService,
		readonly translateService: TranslateService
	) {
		super(translateService);
	}

	@ViewChild('employeeSelector')
	employeeSelector: EmployeeSelectorComponent;

	proposal?: Proposal;
	form: FormGroup;
	employeeName: string;
	statuses: string[] = Object.values(ProposalStatusEnum);
	loading = true;
	private _selectedOrganizationId: string;
	private _ngDestroy$ = new Subject<void>();
	jobPostContent = '';
	proposalContent = '';
	tags: Tag[] = [];

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
			proposalContent: '',
			tags: ''
		});
	}

	public async registerProposal() {
		if (this.form.valid) {
			const result = this.form.value;
			const selectedEmployee = this.employeeSelector.selectedEmployee.id;

			try {
				if (selectedEmployee) {
					await this.proposalsService.create({
						employeeId: selectedEmployee,
						organizationId: this._selectedOrganizationId,
						jobPostUrl: result.jobPostUrl,
						valueDate: result.valueDate,
						jobPostContent: result.jobPostContent,
						proposalContent: result.proposalContent,
						status: this.statuses[0],
						tags: this.tags
					});

					// TODO translate
					this.toastrService.primary(
						this.getTranslation(
							'NOTES.PROPOSALS.REGISTER_PROPOSAL'
						),
						this.getTranslation('TOASTR.TITLE.SUCCESS')
					);

					this.router.navigate(['/pages/sales/proposals']);
				} else {
					this.toastrService.primary(
						this.getTranslation(
							'NOTES.PROPOSALS.REGISTER_PROPOSAL_NO_EMPLOEE_SELECTED'
						),
						this.getTranslation(
							'TOASTR.MESSAGE.REGISTER_PROPOSAL_NO_EMPLOEE_MSG'
						)
					);
				}
			} catch (error) {
				this.toastrService.danger(
					this.getTranslation(
						'NOTES.PROPOSALS.REGISTER_PROPOSAL_ERROR',
						{
							error: error.message
						}
					),
					this.getTranslation('TOASTR.TITLE.ERROR')
				);
			}
		}
	}
	selectedTagsEvent(ev) {
		this.tags = ev;
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
