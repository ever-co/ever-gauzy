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
	}

	/**
	 * Releases the trail and detaches the relocated element — it lives outside
	 * this component's host, so Angular's view destruction would leave it behind.
	 */
	ngOnDestroy(): void {
		if (HeaderTitleComponent.trailOwner === this) {
			HeaderTitleComponent.trailOwner = null;
		}

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
