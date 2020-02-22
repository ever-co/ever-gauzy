import { Component, OnInit } from '@angular/core';
import { Store } from '../../../@core/services/store.service';
import { ProposalViewModel } from '../proposals.component';
import { FormGroup, FormBuilder } from '@angular/forms';
import { Router } from '@angular/router';
import { ProposalsService } from '../../../@core/services/proposals.service';
import { NbToastrService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';

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
		private proposalsService: ProposalsService,
		private translate: TranslateService
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

				// TODO translate
				this.toastrService.primary(
					this.getTranslation('NOTES.PROPOSALS.EDIT_PROPOSAL'),
					this.getTranslation('TOASTR.TITLE.SUCCESS')
				);

				this.router.navigate([`/pages/proposals`]);
			} catch (error) {
				this.toastrService.danger(
					this.getTranslation(
						'NOTES.PROPOSALS.REGISTER_PROPOSAL_ERROR',
						{
							error: error.error.message || error.message
						}
					),
					this.getTranslation('TOASTR.TITLE.ERROR')
				);
			}
		}
	}

	getTranslation(prefix: string, params?: Object) {
		let result = prefix;
		this.translate.get(prefix, params).subscribe((res) => {
			result = res;
		});
		return result;
	}
}
