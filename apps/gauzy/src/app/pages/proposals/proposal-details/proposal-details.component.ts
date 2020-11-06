import { Component, OnDestroy, OnInit } from '@angular/core';
import { Store } from '../../../@core/services/store.service';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { IProposalViewModel } from '@gauzy/models';
import { ProposalsService } from '../../../@core/services/proposals.service';
import { filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-proposal-details',
	templateUrl: './proposal-details.component.html',
	styleUrls: ['./proposal-details.component.scss']
})
export class ProposalDetailsComponent implements OnInit, OnDestroy {
	constructor(
		private route: ActivatedRoute,
		private store: Store,
		private sanitizer: DomSanitizer,
		private router: Router,
		private proposalsService: ProposalsService
	) {}

	proposal: IProposalViewModel;
	jobPostLink: SafeHtml;
	jobPostContent: SafeHtml;
	proposalContent: SafeHtml;
	author: string;
	proposalId: string;

	ngOnInit() {
		this.route.params
			.pipe(
				untilDestroyed(this),
				tap((params) => (this.proposalId = params['id']))
			)
			.subscribe();
		this.store.selectedOrganization$
			.pipe(
				filter((organization) => !!organization),
				untilDestroyed(this),
				tap(() => this.getProposalById())
			)
			.subscribe();
	}

	ngOnDestroy() {}

	async getProposalById() {
		if (!this.proposalId) {
			this.router.navigate([`/pages/sales/proposals`]);
		}
		const { tenantId } = this.store.user;
		const proposal = await this.proposalsService.getById(
			this.proposalId,
			{ tenantId },
			['employee', 'employee.user', 'tags']
		);
		this.proposal = Object.assign({}, proposal, {
			jobPostLink:
				'<a href="' +
				proposal.jobPostUrl +
				`" target="_blank">${proposal.jobPostUrl.substr(
					8,
					14
				)}</nb-icon></a>`,
			jobTitle: proposal.jobPostContent
				.toString()
				.replace(/<[^>]*(>|$)|&nbsp;/g, '')
				.split(/[\s,\n]+/)
				.slice(0, 3)
				.join(' '),
			author: proposal.employee.user
				? proposal.employee.user.firstName +
				  ' ' +
				  proposal.employee.user.lastName
				: ''
		});
		this.setProposal();
	}

	setProposal() {
		this.jobPostLink = this.proposal.jobPostUrl;
		this.jobPostContent = this.sanitizer.bypassSecurityTrustHtml(
			this.proposal.jobPostContent
		);
		this.proposalContent = this.sanitizer.bypassSecurityTrustHtml(
			this.proposal.proposalContent
		);
		if (!this.proposal.author) {
			this.author =
				this.store.selectedEmployee.firstName +
				' ' +
				this.store.selectedEmployee.lastName;
		} else {
			this.author = this.proposal.author;
		}
	}

	edit() {
		this.router.navigate([
			`/pages/sales/proposals/edit/${this.proposal.id}`
		]);
	}
}
