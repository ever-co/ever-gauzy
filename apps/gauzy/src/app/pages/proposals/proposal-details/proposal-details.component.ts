import { Component, OnDestroy, OnInit } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { IOrganization, IProposalViewModel, IUser } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { distinctUntilChange } from '@gauzy/common-angular';
import { filter, tap } from 'rxjs/operators';
import { ProposalsService, Store } from '../../../@core/services';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-proposal-details',
	templateUrl: './proposal-details.component.html',
	styleUrls: ['./proposal-details.component.scss']
})
export class ProposalDetailsComponent implements OnInit, OnDestroy {

	constructor(
		private readonly route: ActivatedRoute,
		private readonly store: Store,
		private readonly sanitizer: DomSanitizer,
		private readonly router: Router,
		private readonly proposalsService: ProposalsService
	) {}

	user: IUser;
	proposal: IProposalViewModel;
	jobPostLink: SafeHtml;
	jobPostContent: SafeHtml;
	proposalContent: SafeHtml;
	author: any;
	proposalId: string;

	ngOnInit() {
		this.store.user$
			.pipe(
				filter((user: IUser) => !!user),
				tap((user: IUser) => (this.user = user)),
				untilDestroyed(this)
			)
			.subscribe();
		this.route.params
			.pipe(
				untilDestroyed(this),
				tap((params) => (this.proposalId = params['id']))
			)
			.subscribe();
		this.store.selectedOrganization$
			.pipe(
				distinctUntilChange(),
				filter((organization: IOrganization) => !!organization),
				tap(() => this.getProposalById()),
				untilDestroyed(this),
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
			jobPostLink: proposal.jobPostUrl ? proposal.jobPostUrl : '',
			jobTitle: proposal.jobPostContent
				.toString()
				.replace(/<[^>]*(>|$)|&nbsp;/g, '')
				.split(/[\s,\n]+/)
				.slice(0, 3)
				.join(' '),
			author: proposal.employee
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
