import { Component, OnInit } from '@angular/core';
import { Store } from '../../../@core/services/store.service';
import { ProposalViewModel } from '../proposals.component';
import { FormGroup, FormBuilder } from '@angular/forms';
import { Router } from '@angular/router';
import { ProposalsService } from '../../../@core/services/proposals.service';
import { NbToastrService } from '@nebular/theme';

@Component({
	selector: 'ngx-proposal-edit',
	templateUrl: './proposal-edit.component.html',
	styleUrls: ['./proposal-edit.component.scss']
})
export class ProposalEditComponent implements OnInit {
	constructor(
		private store: Store,
		private fb: FormBuilder,
		private router: Router,
		private toastrService: NbToastrService,
		private proposalsService: ProposalsService
	) {}

	proposal: ProposalViewModel;
	form: FormGroup;

	ngOnInit() {
		this.proposal = this.store.selectedProposal;

		if (!this.proposal) {
			this.router.navigate([`/pages/proposals`]);
		}

		this._initializeForm();
	}

	private _initializeForm() {
		this.form = this.fb.group({
			jobPostUrl: [this.proposal.jobPostUrl],
			valueDate: [this.proposal.valueDate],
			jobPostContent: this.proposal.jobPostContent,
			proposalContent: this.proposal.proposalContent
		});
	}

	async editProposal() {
		if (this.form.valid) {
			const result = this.form.value;

			try {
				await this.proposalsService.update(this.proposal.id, {
					jobPostContent: result.jobPostContent,
					jobPostUrl: result.jobPostUrl,
					proposalContent: result.proposalContent
				});

				this.toastrService.primary(
					'Proposal successfuly updated',
					'Success'
				);

				this.router.navigate([`/pages/proposals`]);
			} catch (error) {
				this.toastrService.danger(
					error.error.message || error.message,
					'Error'
				);
			}
		}
	}
}
