import {
	AfterViewInit,
	ChangeDetectorRef,
	Component,
	ElementRef,
	Input,
	OnDestroy,
	OnInit,
	Renderer2,
	ViewChild,
	inject
} from '@angular/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { combineLatest } from 'rxjs';
import { filter, tap } from 'rxjs/operators';
import { IOrganization, ISelectedEmployee, PermissionsEnum } from '@gauzy/contracts';
import { Store } from '@gauzy/ui-core/core';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-header-title',
	templateUrl: './header-title.component.html',
	styles: [
		`
			/*
			 * Page title, NOT a breadcrumb trail — the trail is the separate block
			 * this component renders below the heading (.ga-page-title-trail). The
			 * title used to be 24px/600, which read as an oversized breadcrumb path;
			 * a page heading only needs to out-rank body copy, so it now sits at the
			 * h5 step of the type scale. The org/employee qualifier is deliberately
			 * lighter and muted so the page name is what the eye lands on.
			 */
			:host {
				font-size: 1.25rem;
				font-weight: 600;
				line-height: 1.75rem;
				letter-spacing: -0.01em;
				text-align: left;
			}
			.name,
			.org-name {
				font-size: 1.25rem;
				font-weight: 400;
				line-height: 1.75rem;
				letter-spacing: -0.01em;
				text-align: left;
				color: var(--text-hint-color);
			}
			/*
			 * Deliberately NOT nested under :host — the element is moved out of this
			 * component's host and parked next to the page heading (relocateTrail).
			 * Emulated encapsulation keeps the attribute selector matching wherever
			 * the element ends up.
			 */
			.ga-page-title-trail {
				/*
				 * The heading usually shares a flex row with the page's action
				 * buttons. A full-basis item ordered last drops onto its own line
				 * under the title instead of squeezing in beside it; the row is told
				 * to wrap by the .ga-page-title-row class added in relocateTrail
				 * (rule lives in styles/_overrides.scss, since the row belongs to the
				 * page, not to this component).
				 */
				flex: 0 0 100%;
				order: 1;
				min-width: 0;
				/* Sit under the title, not jammed against it. */
				margin-top: 0.25rem;
			}
		`
	],
	standalone: false
})
export class HeaderTitleComponent implements OnInit, AfterViewInit, OnDestroy {
	/**
	 * The title currently rendering the breadcrumb trail.
	 *
	 * A page may nest titles (a layout title around an embedded page that carries
	 * its own — `ga-invites` inside the users page, for instance), and two trails
	 * on one screen is worse than none. `ngOnInit` runs outermost-first, so the
	 * page-level title claims the trail and any nested one stays quiet.
	 */
	private static trailOwner: HeaderTitleComponent | null = null;

	/** Headings this component may be nested in — the trail is parked right after one. */
	private static readonly HEADING_SELECTOR = 'h1, h2, h3, h4, h5, h6';

	/** Marks the flex row holding the heading so it is allowed to wrap. */
	private static readonly HEADING_ROW_CLASS = 'ga-page-title-row';

	/** Marks the card header whose title and action row are laid out as one line. */
	private static readonly PAGE_HEADER_CLASS = 'ga-page-header';

	/** Marks the block inside that header which carries the title and the trail. */
	private static readonly PAGE_HEADER_MAIN_CLASS = 'ga-page-header-main';

	PermissionsEnum: typeof PermissionsEnum = PermissionsEnum;
	organization: IOrganization;
	employee: ISelectedEmployee;

	/** True when this instance is the one rendering the breadcrumb trail. */
	ownsTrail = false;

	@ViewChild('trail') private readonly trailRef?: ElementRef<HTMLElement>;

	private readonly elementRef = inject(ElementRef);
	private readonly renderer = inject(Renderer2);

	/** Element the trail was moved into, so it can be detached again on destroy. */
	private trailHost: HTMLElement | null = null;

	/** Card header marked as a one-line page header, so the mark can be undone. */
	private pageHeader: HTMLElement | null = null;

	/** Block inside it marked as the title side of that line. */
	private pageHeaderMain: HTMLElement | null = null;

	/**
	 * Watches this title for becoming visible, so a trail stranded in a hidden
	 * subtree can be taken over. See `claimTrailIfOrphaned`.
	 */
	private visibilityObserver: IntersectionObserver | null = null;

	_allowEmployee: boolean = true;
	get allowEmployee(): boolean {
		return this._allowEmployee;
	}
	@Input() set allowEmployee(value: boolean) {
		this._allowEmployee = value;
	}

	constructor(
		private readonly store: Store,
		private readonly crd: ChangeDetectorRef
	) {}

	/**
	 * Claims the breadcrumb trail (unless an outer title already holds it) and
	 * tracks the selected organization / employee named in the title.
	 */
	ngOnInit() {
		const owner = HeaderTitleComponent.trailOwner;
		// `isConnected` is the self-healing part: should an owner ever be dropped
		// without its ngOnDestroy running, the next title takes the trail over
		// rather than leaving every page without one.
		if (!owner || owner === this || !owner.elementRef.nativeElement.isConnected) {
			HeaderTitleComponent.trailOwner = this;
			this.ownsTrail = true;
		}

		const storeOrganization$ = this.store.selectedOrganization$.pipe(
			filter((organization: IOrganization) => !!organization)
		);
		const storeEmployee$ = this.store.selectedEmployee$;

		combineLatest({ organization: storeOrganization$, employee: storeEmployee$ })
			.pipe(
				tap(({ organization, employee }) => {
					this.organization = organization;
					this.employee = employee;
					this.crd.detectChanges();
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Moves the trail out of the heading it would otherwise be nested inside.
	 */
	ngAfterViewInit(): void {
		this.relocateTrail();
		this.markPageHeader();
		this.observeVisibility();
	}

	/**
	 * Starts watching for this title becoming visible.
	 *
	 * Ownership is claimed once, in `ngOnInit`, which is correct for a page whose
	 * titles are all live at once — but not for a tabset. `gz-dynamic-tabs` creates
	 * every tab's content up front and Nebular hides the inactive ones with
	 * `display: none`, so on the dashboard the first tab ("Teams") claims the trail
	 * and then takes it into a hidden subtree the moment another tab is selected,
	 * leaving that tab with no breadcrumbs at all. `isConnected` does not catch this:
	 * a `display: none` element is still connected.
	 *
	 * An observer is used rather than a check on each change-detection pass because
	 * every way of asking "is this visible" forces layout; this way the question is
	 * only asked when the browser reports the element actually came into view.
	 */
	private observeVisibility(): void {
		if (typeof IntersectionObserver === 'undefined') {
			return;
		}

		this.visibilityObserver = new IntersectionObserver((entries: IntersectionObserverEntry[]) => {
			if (entries.some((entry: IntersectionObserverEntry) => entry.isIntersecting)) {
				this.claimTrailIfOrphaned();
			}
		});
		this.visibilityObserver.observe(this.elementRef.nativeElement);
	}

	/**
	 * Takes the trail over when the current owner is gone or is no longer rendered.
	 *
	 * Runs from the observer callback — outside change detection — so the view can
	 * be updated and the trail re-parked synchronously.
	 */
	private claimTrailIfOrphaned(): void {
		const owner = HeaderTitleComponent.trailOwner;
		if (owner === this) {
			return;
		}
		// A healthy owner keeps the trail; it is lost only by an owner that has been
		// detached, or one that no longer renders.
		if (owner && owner.elementRef.nativeElement.isConnected && owner.isRendered()) {
			return;
		}

		owner?.releaseTrail();
		HeaderTitleComponent.trailOwner = this;
		this.ownsTrail = true;
		// Render the trail element, then park it next to this title's heading.
		this.crd.detectChanges();
		this.relocateTrail();
	}

	/** Whether this title currently generates boxes (false under `display: none`). */
	private isRendered(): boolean {
		return (this.elementRef.nativeElement as HTMLElement).getClientRects().length > 0;
	}

	/**
	 * Gives up the trail, detaching the relocated element so it does not linger in
	 * the old host once another title renders its own.
	 */
	private releaseTrail(): void {
		this.detachTrail();
		this.ownsTrail = false;
		this.crd.detectChanges();
	}

	/**
	 * Releases the trail and detaches the relocated element — it lives outside
	 * this component's host, so Angular's view destruction would leave it behind.
	 */
	ngOnDestroy(): void {
		if (HeaderTitleComponent.trailOwner === this) {
			HeaderTitleComponent.trailOwner = null;
		}

		this.visibilityObserver?.disconnect();
		this.visibilityObserver = null;

		this.detachTrail();
		this.clearPageHeaderMarks();
	}

	/**
	 * Marks the card header so the page action row can share the title's line.
	 *
	 * Pages render that header as a stack: a block holding the `<h4>` (with the
	 * relocated trail under it), then a second block whose only content is the
	 * action buttons pinned to its right edge. That second block is empty across
	 * its whole width and costs the table below it about four rem of height, so
	 * the two are marked here and laid out as one row by the `.ga-page-header`
	 * rule in `styles/_overrides.scss`. Marking happens from this component
	 * because the ~45 page templates involved share no wrapper class for them.
	 */
	private markPageHeader(): void {
		const heading: HTMLElement | null = this.elementRef.nativeElement.closest(
			HeaderTitleComponent.HEADING_SELECTOR
		);
		const header: HTMLElement | null = heading?.closest<HTMLElement>('nb-card-header') ?? null;
		if (!heading || !header) {
			return;
		}

		// The title needs a block of its own to become the row's left-hand item.
		// Where the page dropped the heading straight into the card header there
		// is nothing to pair the buttons with, so that layout is left alone.
		const main = this.headerChildContaining(header, heading);
		if (!main) {
			return;
		}

		// Only a header that STACKS its children has a band to reclaim. One that
		// already runs as a row (`nb-card-header.card-header-title`, or a `d-flex`
		// without `flex-column`) places its children side by side on purpose, and
		// re-flowing it would push them onto separate lines instead.
		const { display, flexDirection } = getComputedStyle(header);
		if ((display === 'flex' || display === 'inline-flex') && flexDirection.startsWith('row')) {
			return;
		}

		// Nothing to lift. A page that grows an action row later keeps the layout
		// it has rather than a half-applied one.
		if (!header.querySelector('ngx-gauzy-button-action')) {
			return;
		}

		this.renderer.addClass(header, HeaderTitleComponent.PAGE_HEADER_CLASS);
		this.renderer.addClass(main, HeaderTitleComponent.PAGE_HEADER_MAIN_CLASS);
		this.pageHeader = header;
		this.pageHeaderMain = main;
	}

	/**
	 * The card header's own child that `node` sits inside, or null when `node` is
	 * that child itself — i.e. when the page gave the heading no wrapper.
	 */
	private headerChildContaining(header: HTMLElement, node: HTMLElement): HTMLElement | null {
		if (node.parentElement === header) {
			return null;
		}
		// `header` is known to be an ancestor of `node` (it was found with
		// `closest`), so the walk always terminates.
		let child: HTMLElement | null = node.parentElement;
		while (child && child.parentElement !== header) {
			child = child.parentElement;
		}
		return child;
	}

	/** Undoes `markPageHeader` — the marks live outside this component's view. */
	private clearPageHeaderMarks(): void {
		if (this.pageHeader) {
			this.renderer.removeClass(this.pageHeader, HeaderTitleComponent.PAGE_HEADER_CLASS);
			this.pageHeader = null;
		}
		if (this.pageHeaderMain) {
			this.renderer.removeClass(this.pageHeaderMain, HeaderTitleComponent.PAGE_HEADER_MAIN_CLASS);
			this.pageHeaderMain = null;
		}
	}

	/**
	 * Removes the relocated trail from the host it was parked in. It lives outside
	 * this component's view, so Angular's own teardown would leave it behind.
	 */
	private detachTrail(): void {
		// `this.trailHost &&` stays FIRST and the comparison stays an identity
		// check: the trail may have been detached already (`parentNode === null`),
		// and `null === null` would otherwise "match" a host that is itself null.
		const trail = this.trailRef?.nativeElement;
		if (this.trailHost && trail?.parentNode === this.trailHost) {
			this.renderer.removeChild(this.trailHost, trail);
		}
		this.trailHost = null;
	}

	/**
	 * Parks the breadcrumb trail immediately after the heading that wraps this
	 * component, as a sibling block.
	 *
	 * Every call site writes `<h4><ngx-header-title>…</ngx-header-title></h4>`,
	 * and a heading may only contain phrasing content: rendering the trail's
	 * `<nav><ol>` in place would be invalid HTML *and* would fold the crumb text
	 * into the heading's accessible name ("Expenses for Acme Dashboards
	 * Accounting Expenses, heading level 4"). Moving the element leaves the
	 * Angular view — and therefore change detection — untouched.
	 */
	private relocateTrail(): void {
		const trail = this.trailRef?.nativeElement;
		if (!trail) {
			return;
		}

		const heading: HTMLElement | null = this.elementRef.nativeElement.closest(
			HeaderTitleComponent.HEADING_SELECTOR
		);
		const host = heading?.parentElement;

		// Used outside a heading: the trail is already a block of its own, leave it.
		if (!heading || !host) {
			return;
		}

		this.renderer.insertBefore(host, trail, heading.nextSibling);
		this.renderer.addClass(host, HeaderTitleComponent.HEADING_ROW_CLASS);
		this.trailHost = host;
	}
}
