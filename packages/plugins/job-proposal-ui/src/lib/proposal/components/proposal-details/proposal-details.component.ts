import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ChangeDetectionStrategy } from '@angular/core';
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

	/** Text color per card + tag background, so each pair is measured once. */
	private readonly tagTextColors = new Map<string, string>();
	/** 1×1 canvas the tag colors are painted on to read them back as sRGB. */
	private colorContext?: CanvasRenderingContext2D | null;

	/**
	 * Picks dark or light text for a tag so its name stays readable on any
	 * background, unless the tag sets its own text color.
	 */
	tagTextColor(tag: ITag): string {
		if (tag.textColor) {
			return tag.textColor;
		}
		// Translucent tags show the card behind them, so the card color is part of
		// the key: a theme switch changes it and the text color is measured again.
		const card =
			getComputedStyle(this.elementRef.nativeElement).getPropertyValue('--gauzy-card-1').trim() || '#fff';
		const color = tag.color || '';
		const key = `${card}|${color}`;
		if (!this.tagTextColors.has(key)) {
			this.tagTextColors.set(key, this.contrastTextColor(color, card));
		}
		return this.tagTextColors.get(key);
	}

	/**
	 * Paints the card color, then the tag color over it, and reads the pixel back.
	 * The browser converts any CSS color (#fff, hsl(), lab(), names…) to sRGB and
	 * blends a translucent one with the card, so the result is the color the tag
	 * actually shows. An unreadable tag color leaves the card color. Returns
	 * whichever of black or white text has the higher WCAG contrast ratio against it:
	 * pure black, as a softer dark can leave a mid-grey tag under 4.5:1 either way.
	 */
	private contrastTextColor(color: string, card: string): string {
		if (this.colorContext === undefined) {
			const canvas = document.createElement('canvas');
			canvas.width = canvas.height = 1;
			this.colorContext = canvas.getContext('2d', { willReadFrequently: true });
		}
		const context = this.colorContext;
		if (!context) {
			return '';
		}
		context.clearRect(0, 0, 1, 1);
		context.fillStyle = '#fff';
		context.fillStyle = card;
		context.fillRect(0, 0, 1, 1);
		if (color) {
			context.fillStyle = color;
			context.fillRect(0, 0, 1, 1);
		}
		const [r, g, b] = context.getImageData(0, 0, 1, 1).data;

		const background = this.relativeLuminance(r, g, b);
		// Black's relative luminance is 0.
		const blackContrast = (background + 0.05) / 0.05;
		const whiteContrast = 1.05 / (background + 0.05);
		return blackContrast >= whiteContrast ? '#000' : '#fff';
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
		private readonly router: Router,
		private readonly elementRef: ElementRef<HTMLElement>
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
