import { AfterViewInit, Component, OnDestroy, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { BaseEntityEnum, IEmployee, IProposal, ITag, IUser, ProposalStatusEnum } from '@gauzy/contracts';
import { Store } from '@gauzy/ui-core/core';

@UntilDestroy({ checkProperties: true })
@Component({
    selector: 'ngx-proposal-details',
    templateUrl: './proposal-details.component.html',
    styleUrls: ['./proposal-details.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class ProposalDetailsComponent implements AfterViewInit, OnInit, OnDestroy {
	/** The favorite toggle binds the enum member: the library compiles its templates strictly. */
	protected readonly BaseEntityEnum = BaseEntityEnum;
	public user: IUser;
	public employee: IEmployee;
	public proposal: IProposal;
	public jobPostLink: SafeHtml;
	public jobPostContent: SafeHtml;
	public proposalContent: SafeHtml;

	get isAccepted(): boolean {
		return this.proposal?.status === ProposalStatusEnum.ACCEPTED;
	}

	/**
	 * Picks dark or light text for a tag so its name stays readable on any
	 * background, unless the tag sets its own text color.
	 */
	tagTextColor(tag: ITag): string {
		if (tag.textColor) {
			return tag.textColor;
		}
		const hex = (tag.color || '').replace('#', '');
		if (!/^[0-9a-f]{6}$/i.test(hex)) {
			return '#fff';
		}
		const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
		return 0.299 * r + 0.587 * g + 0.114 * b > 160 ? '#1a1a1a' : '#fff';
	}

	constructor(
		private readonly route: ActivatedRoute,
		private readonly store: Store,
		private readonly sanitizer: DomSanitizer,
		private readonly router: Router
	) {}

	ngOnInit(): void {
		this.store.user$
			.pipe(
				filter((user: IUser) => !!user),
				tap((user: IUser) => (this.user = user)),
				tap((user: IUser) => (this.employee = user?.employee)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit(): void {
		this.route.data
			.pipe(
				debounceTime(100),
				filter((data) => !!data && !!data.proposal),
				tap(({ proposal }) => {
					try {
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
					} catch (error) {
						this.router.navigate(['/pages/sales/proposals']);
					}
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Sets the proposal data.
	 */
	setProposal() {
		this.jobPostLink = this.proposal.jobPostUrl;
		this.jobPostContent = this.sanitizer.bypassSecurityTrustHtml(this.proposal.jobPostContent);
		this.proposalContent = this.sanitizer.bypassSecurityTrustHtml(this.proposal.proposalContent);
	}

	/**
	 * Navigates to the edit page of the proposal.
	 */
	edit() {
		if (this.proposal) {
			this.router.navigate([`/pages/sales/proposals/edit`, this.proposal.id]);
		}
	}

	ngOnDestroy(): void {}
}
