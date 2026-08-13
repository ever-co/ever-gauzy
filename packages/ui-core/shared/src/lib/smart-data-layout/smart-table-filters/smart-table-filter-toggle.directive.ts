import {
	AfterViewInit,
	ChangeDetectorRef,
	Directive,
	ElementRef,
	HostBinding,
	NgZone,
	OnDestroy,
	OnInit,
	Renderer2,
	inject
} from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

/**
 * Collapses every smart table's filter row behind a funnel toggle in the
 * header row.
 *
 * The filter row (`tr.angular2-smart-filters`) is a full row of input-height
 * widgets that most visits never touch — it cost every list page a band of
 * vertical space and, with each page styling its own widgets, the inputs did
 * not even share a height. The row now starts hidden; a funnel button at the
 * right end of the title row shows it on demand.
 *
 * Attached by element selector through `SmartDataViewLayoutModule` (the
 * `SmartTableSettlingDirective` precedent), so all ~116 consuming modules get
 * the behavior with no template change. The button is real DOM appended into
 * the title row's last `th` — the library owns that subtree, so a
 * MutationObserver re-attaches the button whenever the header is re-rendered
 * (column rebuilds on language change, settings swaps, and so on).
 *
 * State rules, in priority order:
 *  1. a row with an ACTIVE filter is never hidden on load — hidden state would
 *     silently constrain the data;
 *  2. otherwise the user's last explicit choice (localStorage) wins — one
 *     preference for the whole app, deliberately, so tables feel consistent;
 *  3. otherwise: collapsed.
 * Collapsing does NOT clear filter values; while any are active the funnel
 * carries an indicator dot so hidden-but-filtering is always visible.
 */
@Directive({
	selector: 'angular2-smart-table',
	standalone: false
})
export class SmartTableFilterToggleDirective implements OnInit, AfterViewInit, OnDestroy {
	/**
	 * One app-wide preference: 'open' | 'closed'.
	 *
	 * Mirrored as a literal in the e2e fixtures (apps/gauzy-e2e/tests/support/
	 * fixtures.ts and bdd.ts) — they run in a separate build that cannot import
	 * this class. Rename both sides together.
	 */
	static readonly STORAGE_KEY = 'gauzy.smartTable.filtersOpen';

	@HostBinding('class.ga-filters-collapsed') collapsed = true;

	private readonly elementRef = inject(ElementRef);
	private readonly renderer = inject(Renderer2);
	private readonly zone = inject(NgZone);
	private readonly cdr = inject(ChangeDetectorRef);
	private readonly translate = inject(TranslateService);

	private button: HTMLButtonElement | null = null;
	private observer: MutationObserver | null = null;
	/** Teardown callbacks that live as long as the directive (button, lang sub). */
	private teardownFns: Array<() => void> = [];
	/**
	 * Teardown callbacks for the delegated listeners on the CURRENT filter row,
	 * disposed separately: the library rebuilds thead rows wholesale, and rolling
	 * these into the long-lived list would grow it by a listener pair per rebuild.
	 */
	private rowTeardownFns: Array<() => void> = [];
	/** Row currently carrying the delegated listeners, so teardown can forget it. */
	private listenedRow: HTMLElement | null = null;

	/**
	 * The stored preference is applied BEFORE the first render (OnInit), so the
	 * host class is stable through the first change-detection pass — deciding it
	 * any later flips a host binding after verification and throws NG0100 in dev
	 * mode, which aborts rendering of the surrounding view.
	 */
	ngOnInit(): void {
		try {
			this.collapsed = localStorage.getItem(SmartTableFilterToggleDirective.STORAGE_KEY) !== 'open';
		} catch {
			this.collapsed = true;
		}
	}

	ngAfterViewInit(): void {
		this.ensureToggle();

		// A row holding an ACTIVE filter is never left hidden — but the check
		// needs the rendered DOM, so the reopen runs as a macrotask in its own
		// change-detection round (a microtask would still trip NG0100).
		if (this.collapsed && this.hasActiveFilter()) {
			setTimeout(() => {
				this.collapsed = false;
				if (this.button) {
					this.syncAria(this.button);
				}
				this.cdr.markForCheck();
			});
		}

		if (typeof MutationObserver === 'undefined') {
			return;
		}
		// The library re-creates thead rows wholesale; watching the host keeps the
		// button alive through that. Outside Angular so the (frequent) body-row
		// mutations never schedule change detection; the callback exits cheaply
		// while the button is still connected.
		this.zone.runOutsideAngular(() => {
			this.observer = new MutationObserver(() => {
				if (!this.button || !this.button.isConnected) {
					this.ensureToggle();
				} else {
					// Filters can be restored programmatically (no input event) — keep
					// the indicator honest; this only touches the one filter row.
					this.reflectActiveState();
				}
			});
			this.observer.observe(this.elementRef.nativeElement, { childList: true, subtree: true });
		});
	}

	ngOnDestroy(): void {
		this.observer?.disconnect();
		this.observer = null;
		this.detachButton();
	}

	private host(): HTMLElement {
		return this.elementRef.nativeElement as HTMLElement;
	}

	private filterRow(): HTMLTableRowElement | null {
		return this.host().querySelector('thead tr.angular2-smart-filters');
	}

	private titlesRow(): HTMLTableRowElement | null {
		return this.host().querySelector('thead tr.angular2-smart-titles');
	}

	/**
	 * Puts the funnel into the title row's last header cell (or takes it away
	 * again when the table renders without a usable filter row).
	 */
	private ensureToggle(): void {
		const titles = this.titlesRow();
		const filters = this.filterRow();
		const hasFilters = !!titles && !!filters && !!filters.querySelector('.angular2-smart-filter input, .angular2-smart-filter select, .angular2-smart-filter ng-select, .angular2-smart-filter nb-select, .angular2-smart-filter [class*="filter"]');

		if (!hasFilters) {
			this.detachButton();
			return;
		}

		const cell = titles.lastElementChild as HTMLElement | null;
		if (!cell) {
			return;
		}

		if (!this.button) {
			this.button = this.createButton();
			// Toggling flips a host-binding class, so the click must be a zone event.
			this.teardownFns.push(this.renderer.listen(this.button, 'click', (event: Event) => {
				event.stopPropagation();
				this.toggle();
			}));
		}
		if (this.button.parentElement !== cell) {
			this.renderer.addClass(cell, 'ga-has-filter-toggle');
			this.renderer.appendChild(cell, this.button);
		}

		// The dot tracks values typed into the row; delegated, so re-rendered
		// widgets stay covered without re-subscribing per input.
		if (this.listenedRow !== filters) {
			this.rowTeardownFns.forEach((teardown) => teardown());
			this.rowTeardownFns = [];
			this.listenedRow = filters;
			this.zone.runOutsideAngular(() => {
				const update = () => this.reflectActiveState();
				this.rowTeardownFns.push(this.renderer.listen(filters, 'input', update));
				this.rowTeardownFns.push(this.renderer.listen(filters, 'change', update));
				// Button-based widgets (the accept/deny toggle filter) fire neither
				// input nor change — only a click reveals their state moved.
				this.rowTeardownFns.push(this.renderer.listen(filters, 'click', update));
			});
		}

		this.reflectActiveState();
	}

	private createButton(): HTMLButtonElement {
		const button: HTMLButtonElement = this.renderer.createElement('button');
		button.type = 'button';
		button.className = 'ga-table-filter-toggle';
		// eva `funnel-outline`, inlined: the button lives outside any Angular
		// template, so `nb-icon` is not available to it.
		button.innerHTML =
			'<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="currentColor">' +
			'<path d="M13.9 22a1 1 0 0 1-.6-.2l-4-3.05a1 1 0 0 1-.39-.8v-3.27l-4.8-9.22A1 1 0 0 1 5 4h14a1 1 0 0 1 .89 1.46l-4.8 9.22V21a1 1 0 0 1-1 1zm-3-4.54 2 1.53v-4.55a1 1 0 0 1 .11-.46L17.35 6h-10.7l4.14 7.98a1 1 0 0 1 .11.46z"/>' +
			'</svg>';
		this.applyLabel(button);
		// instant() may have run before translations loaded, and the user can
		// switch language with the table mounted.
		const langSub = this.translate.onLangChange.subscribe(() => this.applyLabel(button));
		this.teardownFns.push(() => langSub.unsubscribe());
		this.syncAria(button);
		return button;
	}

	/** (Re-)translates the button's accessible name and tooltip. */
	private applyLabel(button: HTMLButtonElement): void {
		const label = this.translate.instant('BUTTONS.FILTER');
		button.setAttribute('aria-label', label);
		button.setAttribute('title', label);
	}

	private toggle(): void {
		this.collapsed = !this.collapsed;
		try {
			localStorage.setItem(SmartTableFilterToggleDirective.STORAGE_KEY, this.collapsed ? 'closed' : 'open');
		} catch {
			// Storage may be unavailable (private mode); the toggle still works for the session.
		}
		if (this.button) {
			this.syncAria(this.button);
		}
		this.cdr.markForCheck();
	}

	private syncAria(button: HTMLButtonElement): void {
		button.setAttribute('aria-pressed', String(!this.collapsed));
	}

	/** True while any filter widget in the row holds a value. */
	private hasActiveFilter(): boolean {
		const filters = this.filterRow();
		if (!filters) {
			return false;
		}
		const inputs = Array.from(filters.querySelectorAll('input, textarea')) as HTMLInputElement[];
		if (inputs.some((input) => input.value?.trim().length > 0)) {
			return true;
		}
		const selects = Array.from(filters.querySelectorAll('select')) as HTMLSelectElement[];
		if (selects.some((select) => select.selectedIndex > 0)) {
			return true;
		}
		// ng-select marks its host; nb-select marks the ABSENCE of a value with
		// `.placeholder` on its trigger button (never on the host); the
		// accept/deny toggle filter marks its active CHOICE button with `.on`
		// (`.na.on` means "no filter", so only check/deny count).
		return (
			!!filters.querySelector('.ng-select.ng-has-value') ||
			!!filters.querySelector('nb-select .select-button:not(.placeholder)') ||
			!!filters.querySelector('button.check.on, button.deny.on')
		);
	}

	private reflectActiveState(): void {
		if (!this.button) {
			return;
		}
		const active = this.hasActiveFilter();
		if (active) {
			this.renderer.addClass(this.button, 'ga-active');
		} else {
			this.renderer.removeClass(this.button, 'ga-active');
		}
	}

	private detachButton(): void {
		this.teardownFns.forEach((teardown) => teardown());
		this.teardownFns = [];
		this.rowTeardownFns.forEach((teardown) => teardown());
		this.rowTeardownFns = [];
		// The delegated listeners just died with the callbacks above — forget
		// the row they were on, or a re-render of the same row never
		// re-registers them and the indicator dot stops tracking typed values.
		this.listenedRow = null;
		if (this.button?.parentElement) {
			this.renderer.removeChild(this.button.parentElement, this.button);
		}
		this.button = null;
	}
}
