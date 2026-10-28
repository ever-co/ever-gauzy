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

	/** Text color per tag background, so each color is parsed once. */
	private readonly tagTextColors = new Map<string, string>();

	/**
	 * Picks dark or light text for a tag so its name stays readable on any
	 * background, unless the tag sets its own text color.
	 */
	tagTextColor(tag: ITag): string {
		if (tag.textColor) {
			return tag.textColor;
		}
		const color = tag.color || '';
		if (!this.tagTextColors.has(color)) {
			this.tagTextColors.set(color, this.contrastTextColor(color));
		}
		return this.tagTextColors.get(color);
	}

	/**
	 * Lets the browser parse any CSS color (#fff, #ffffff80, rgb(), hsl(), names)
	 * into `#rrggbb` or `rgba(r, g, b, a)`, then picks whichever of dark or white
	 * text has the higher WCAG contrast ratio against it. An empty
	 * result keeps the theme's text color, for colors that can't be read or are
	 * mostly transparent and so show the card behind them.
	 */
	private contrastTextColor(color: string): string {
		const context = document.createElement('canvas').getContext('2d');
		if (!color || !context) {
			return '';
		}
		// An unparseable value leaves fillStyle unchanged, so start from a sentinel.
		context.fillStyle = '#010203';
		context.fillStyle = color;
		const parsed = String(context.fillStyle);
		if (parsed === '#010203' && !/^#010203$/i.test(color.trim())) {
			return '';
		}

		let r: number, g: number, b: number;
		let alpha = 1;
		if (parsed.startsWith('#')) {
			[r, g, b] = [1, 3, 5].map((i) => parseInt(parsed.slice(i, i + 2), 16));
		} else {
			[r, g, b, alpha = 1] = (parsed.match(/[\d.]+/g) || []).map(Number);
		}
		if ([r, g, b].some((value) => !Number.isFinite(value)) || alpha < 0.5) {
			return '';
		}
		const background = this.relativeLuminance(r, g, b);
		const dark = this.relativeLuminance(0x1a, 0x1a, 0x1a);
		const darkContrast = (background + 0.05) / (dark + 0.05);
		const whiteContrast = 1.05 / (background + 0.05);
		return darkContrast >= whiteContrast ? '#1a1a1a' : '#fff';
	}

	/** WCAG 2 relative luminance of an sRGB color with 0–255 channels. */
	private relativeLuminance(r: number, g: number, b: number): number {
		const [lr, lg, lb] = [r, g, b].map((channel) => {
			const c = channel / 255;
			return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
		});
		return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
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
