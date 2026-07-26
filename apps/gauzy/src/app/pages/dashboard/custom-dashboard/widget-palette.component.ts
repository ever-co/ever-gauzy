import { Component, EventEmitter, Injector, Input, Output, Signal, runInInjectionContext } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ResolveFn } from '@angular/router';
import { BehaviorSubject, combineLatest, Observable } from 'rxjs';
import { map, shareReplay, startWith } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';
import { PermissionsEnum } from '@gauzy/contracts';
import { Store, WidgetCategory, WidgetRegistryConfig, WidgetRegistryService } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { DASHBOARD_CANVAS_DROP_LIST_ID } from './dashboard-canvas.component';

/** A single palette entry (a registered widget the user may add). */
export interface IWidgetPaletteItem {
	widgetId: string;
	title: string;
	description?: string;
	icon: string;
	category: WidgetCategory;
}

/** Palette entries of one category. */
export interface IWidgetPaletteGroup {
	category: WidgetCategory;
	/** Translation key of the category heading. */
	labelKey: string;
	items: IWidgetPaletteItem[];
}

/** Display order of the palette categories (anything unknown falls to the end). */
const CATEGORY_ORDER: WidgetCategory[] = [
	'time-tracking',
	'accounting',
	'hr',
	'teams',
	'project-management',
	'plugin',
	'other'
];

/** Category -> translation key suffix under `DASHBOARD_PAGE.BUILDER.CATEGORIES`. */
const CATEGORY_LABELS: Record<WidgetCategory, string> = {
	'time-tracking': 'TIME_TRACKING',
	accounting: 'ACCOUNTING',
	hr: 'HR',
	teams: 'TEAMS',
	'project-management': 'PROJECT_MANAGEMENT',
	plugin: 'PLUGIN',
	other: 'OTHER'
};

/**
 * Right-hand panel listing every widget the current user may place on a canvas.
 *
 * Entries can be dragged onto the canvas, and — because dragging is pointer-only
 * and therefore not keyboard accessible — clicking (or pressing Enter on) an
 * entry adds it too, which is the accessible path.
 */
@Component({
	selector: 'ga-widget-palette',
	templateUrl: './widget-palette.component.html',
	styleUrls: ['./widget-palette.component.scss'],
	standalone: false
})
export class WidgetPaletteComponent extends TranslationBaseComponent {
	/** CDK drop list id of the palette itself (nothing may be dropped into it). */
	@Input() public dropListId = 'ga-widget-palette-list';

	/** Drop lists palette entries may be dragged into. */
	@Input() public connectedTo: string[] = [DASHBOARD_CANVAS_DROP_LIST_ID];

	/**
	 * Emits the registry key of the widget to add (click / keyboard path).
	 *
	 * Named `addRequested` rather than `add`: an output that shadows a native DOM
	 * event name makes a parent binding ambiguous.
	 */
	@Output() public readonly addRequested = new EventEmitter<string>();

	/** Categories with their (permission- and search-filtered) widgets. */
	public readonly groups: Signal<IWidgetPaletteGroup[]>;

	/** Total number of visible entries, used for the "no results" state. */
	public readonly total: Signal<number>;

	/** Current search term (mirrored as a field so the template needs no async pipe). */
	public term = '';

	/** Current search term. */
	public readonly search$ = new BehaviorSubject<string>('');

	/** Categories the user collapsed (all expanded by default). */
	private readonly _collapsed = new Set<WidgetCategory>();

	/**
	 * True between `cdkDragStarted` and `cdkDragEnded`.
	 *
	 * Palette entries are `<button>`s so they can be activated from the keyboard,
	 * which means a pointer drag can be followed by a `click` on the same element
	 * — that would add the widget twice (once on drop, once on click).
	 */
	private _dragging = false;

	constructor(
		public readonly translateService: TranslateService,
		private readonly _widgetRegistry: WidgetRegistryService,
		private readonly _store: Store,
		private readonly _injector: Injector
	) {
		super(translateService);

		// `shareReplay` so the two signals below share ONE registry subscription.
		const groups$: Observable<IWidgetPaletteGroup[]> = combineLatest([
			this._widgetRegistry.getWidgets$(),
			// Re-filter when the permission set changes (role switch / reload)
			this._store.userRolePermissions$.pipe(startWith(this._store.userRolePermissions ?? [])),
			this.search$,
			// `_buildGroups` resolves titles/descriptions EAGERLY, so a language
			// switch has to rebuild them — otherwise the palette keeps the old
			// labels (and searches against them) until something else changes.
			this.translateService.onLangChange.pipe(startWith(null))
		]).pipe(
			map(([widgets, , term]) => this._buildGroups(widgets, term)),
			shareReplay({ bufferSize: 1, refCount: true })
		);

		this.groups = toSignal(groups$, { initialValue: [] as IWidgetPaletteGroup[] });
		this.total = toSignal(
			groups$.pipe(map((groups) => groups.reduce((sum, group) => sum + group.items.length, 0))),
			{ initialValue: 0 }
		);
	}

	/**
	 * Nothing may be dropped back into the palette — it is a source list only.
	 * CDK still needs it to be a drop list so its items can be dragged out.
	 */
	public readonly rejectDrops = (): boolean => false;

	/**
	 * Updates the search term.
	 *
	 * @param event - The input event of the search box.
	 */
	public onSearch(event: Event): void {
		this.term = (event.target as HTMLInputElement)?.value ?? '';
		this.search$.next(this.term);
	}

	/**
	 * Clears the search term.
	 *
	 * @param input - The search box, reset alongside the stream.
	 */
	public clearSearch(input: HTMLInputElement): void {
		input.value = '';
		this.term = '';
		this.search$.next('');
	}

	/** Remembers that a pointer drag is in progress. */
	public onDragStarted(): void {
		this._dragging = true;
	}

	/**
	 * Clears the drag flag one task later, so the synthetic `click` some browsers
	 * fire on the source element right after a drop still sees it set.
	 */
	public onDragEnded(): void {
		setTimeout(() => (this._dragging = false));
	}

	/**
	 * Adds a widget from a click / keyboard activation.
	 *
	 * Ignored right after a drag: the drop already added the widget.
	 *
	 * @param widgetId - Registry key of the widget to add.
	 */
	public onPick(widgetId: string): void {
		if (this._dragging) {
			return;
		}
		this.addRequested.emit(widgetId);
	}

	/**
	 * Toggles a category open/closed.
	 *
	 * @param category - The category to toggle.
	 */
	public toggleCategory(category: WidgetCategory): void {
		if (this._collapsed.has(category)) {
			this._collapsed.delete(category);
		} else {
			this._collapsed.add(category);
		}
	}

	/**
	 * Is the given category expanded?
	 *
	 * @param category - The category to check.
	 */
	public isExpanded(category: WidgetCategory): boolean {
		return !this._collapsed.has(category);
	}

	/*
	|--------------------------------------------------------------------------
	| Internals
	|--------------------------------------------------------------------------
	*/

	/** Builds the permission- and search-filtered category groups. */
	private _buildGroups(widgets: WidgetRegistryConfig[], term: string): IWidgetPaletteGroup[] {
		const needle = (term ?? '').trim().toLowerCase();

		const items = (widgets ?? [])
			.filter((widget) => this._isPermitted(widget))
			.map((widget) => this._toItem(widget))
			.filter((item) => !needle || this._matches(item, needle))
			.sort((a, b) => a.title.localeCompare(b.title));

		const byCategory = new Map<WidgetCategory, IWidgetPaletteItem[]>();
		for (const item of items) {
			const bucket = byCategory.get(item.category) ?? [];
			bucket.push(item);
			byCategory.set(item.category, bucket);
		}

		return [...byCategory.keys()]
			.sort((a, b) => this._categoryRank(a) - this._categoryRank(b))
			.map((category) => ({
				category,
				labelKey: `DASHBOARD_PAGE.BUILDER.CATEGORIES.${CATEGORY_LABELS[category] ?? 'OTHER'}`,
				items: byCategory.get(category) ?? []
			}));
	}

	/**
	 * A widget with no declared permissions is available to everyone; otherwise
	 * the user needs at least one of them (mirrors the widget page gating).
	 */
	private _isPermitted(widget: WidgetRegistryConfig): boolean {
		const permissions = (widget?.permissions ?? []) as PermissionsEnum[];
		return permissions.length === 0 || this._store.hasAnyPermission(...permissions);
	}

	/** Maps a registry entry to its palette view model. */
	private _toItem(widget: WidgetRegistryConfig): IWidgetPaletteItem {
		return {
			widgetId: widget.widgetId,
			title: this._resolveText(widget.title) || widget.widgetId,
			description: this._resolveText(widget.description),
			icon: widget.icon || 'cube-outline',
			category: widget.category ?? 'other'
		};
	}

	/** Does the entry match the search term (title, description or id)? */
	private _matches(item: IWidgetPaletteItem, needle: string): boolean {
		return [item.title, item.description, item.widgetId]
			.filter((value): value is string => !!value)
			.some((value) => value.toLowerCase().includes(needle));
	}

	/**
	 * Resolves a registry title/description, which may be a literal, a
	 * translation key, or a resolver function.
	 *
	 * Registry resolvers are typed as `ResolveFn` but never read their route
	 * arguments; they commonly call `inject()`, so they are run in an injection
	 * context — exactly like `<ga-dashboard-widget-host>` does — otherwise every
	 * resolver-titled widget would fall back to showing its raw id. Only
	 * synchronous string results are used: the palette renders a plain list and
	 * has nowhere to await a promise.
	 */
	private _resolveText(value: unknown): string | undefined {
		if (typeof value === 'string') {
			// A translation key resolves; a plain label falls through unchanged.
			return this.getTranslation(value) || value;
		}
		if (typeof value === 'function') {
			try {
				const resolved = runInInjectionContext(this._injector, () =>
					(value as ResolveFn<string>)(null as never, null as never)
				);
				return typeof resolved === 'string' ? this.getTranslation(resolved) || resolved : undefined;
			} catch {
				// A resolver that needs a real route activation must not take the
				// whole palette down — the entry simply shows no extra text.
				return undefined;
			}
		}
		return undefined;
	}

	/** Sort rank of a category (unknown categories go last). */
	private _categoryRank(category: WidgetCategory): number {
		const index = CATEGORY_ORDER.indexOf(category);
		return index === -1 ? CATEGORY_ORDER.length : index;
	}
}
