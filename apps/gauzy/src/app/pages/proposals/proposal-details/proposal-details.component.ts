import { Component, OnInit, SecurityContext } from '@angular/core';
import { Store } from '../../../@core/services/store.service';
import { ProposalViewModel } from '../proposals.component';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Router } from '@angular/router';

@Component({
	selector: 'ngx-proposal-details',
	templateUrl: './proposal-details.component.html',
	styleUrls: ['./proposal-details.component.scss']
})
export class ProposalDetailsComponent implements OnInit {
	constructor(
		private store: Store,
		private sanitizer: DomSanitizer,
		private router: Router
	) {}

	proposal: ProposalViewModel;
	jobPostLink: SafeHtml;
	author: string;
	jobPostContentArr: string[];
	proposalContentArr: string[];

	ngOnInit() {
		this.proposal = this.store.selectedProposal;

		if (!this.proposal) {
			this.router.navigate([`/pages/proposals`]);
		}

		this.jobPostLink = this.sanitizer.bypassSecurityTrustHtml(
			this.proposal.jobPostLink
		);

		if (!this.proposal.author) {
			this.author =
				this.store.selectedEmployee.firstName +
				' ' +
				this.store.selectedEmployee.lastName;
		} else {
			this.author = this.proposal.author;
		}

		console.log(this.proposal.jobPostContent);
		this.jobPostContentArr = this.proposal.jobPostContent.split('\n');
		this.proposalContentArr = this.proposal.proposalContent.split('\n');
	}

	edit() {
		this.router.navigate([`/pages/proposals/edit/${this.proposal.id}`]);
	}
}
