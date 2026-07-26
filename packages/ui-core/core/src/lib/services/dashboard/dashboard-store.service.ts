import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, combineLatest, from, of, Subject } from 'rxjs';
import { catchError, filter, startWith, switchMap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import {
	DashboardLayout,
	ID,
	IDashboard,
	IDashboardLayout,
	IDashboardLayoutItem,
	IDashboardLayoutV2,
	IDashboardTab,
	IDashboardWidgetPlacement,
	JsonData
} from '@gauzy/contracts';
import { DashboardService } from './dashboard.service';
import { createId, isLayoutV2, normalizeLayout, parseLayout } from './dashboard-layout.utils';
import { Store } from '../store/store.service';

/** LocalStorage key prefix holding the currently applied custom dashboard ID (suffixed with the user ID). */
const SELECTED_DASHBOARD_KEY = '_selectedDashboardId';

/** LocalStorage key prefix holding the "Standard" widget layout snapshot taken before a custom dashboard is applied (suffixed with the user ID). */
const STANDARD_LAYOUT_BACKUP_KEY = '_standardDashboardLayout';

/**
 * Client-side state holder for custom user dashboards.
 *
 * Responsibilities:
 * - Loads the current user's custom dashboards for the selected organization.
 * - Tracks the currently applied dashboard (`null` = the Standard dashboard).
 * - Applies/captures the widget layout state, which the existing widget system
 *   (WidgetService/WindowService in @gauzy/ui-core/shared) reads from and writes to
 *   `Store.widgets` / `Store.windows`. A custom dashboard is a persisted snapshot
 *   of that serialized state (`IDashboardLayout`), stored in `IDashboard.contentHtml`.
 * - Preserves the Standard layout in a localStorage backup while a custom
 *   dashboard is active, and restores it when switching back to Standard.
 *
 * Two persisted layout shapes coexist in `IDashboard.contentHtml`:
 * - **v1** (`IDashboardLayout`) — a snapshot of the legacy `GuiDrag` widget
 *   system, applied to `Store.widgets` / `Store.windows` on selection.
 * - **v2** (`IDashboardLayoutV2`) — a dashboard builder document (tabs of freely
 *   placed widget instances) rendered by the canvas. v2 documents are NEVER
 *   applied to the legacy widget state: doing so would clobber the user's
 *   Standard arrangement, which is only ever backed up/restored around v1.
 */
@UntilDestroy()
@Injectable({
	providedIn: 'root'
})
export class DashboardStoreService {
	private readonly _dashboards$ = new BehaviorSubject<IDashboard[]>([]);
	/** The current user's custom dashboards (for the selected organization). */
	public readonly dashboards$ = this._dashboards$.asObservable();

	private readonly _selectedDashboard$ = new BehaviorSubject<IDashboard | null>(null);
	/** The currently applied custom dashboard, or `null` when the Standard dashboard is active. */
	public readonly selectedDashboard$ = this._selectedDashboard$.asObservable();

	private readonly _editing$ = new BehaviorSubject<boolean>(false);
	/** Whether the currently selected custom dashboard is in edit (arrange) mode. */
	public readonly editing$ = this._editing$.asObservable();

	private readonly _refresh$ = new Subject<void>();

	/**
	 * In-progress v2 document staged by the canvas while editing, so the
	 * switcher's Save button (which has no reference to the canvas) can persist
	 * it. `null` whenever there is nothing unsaved.
	 */
	private _pendingLayout: IDashboardLayoutV2 | null = null;

	constructor(
		private readonly _dashboardService: DashboardService,
		private readonly _store: Store,
		private readonly _router: Router
	) {
		this._listenToChangesAndLoadDashboards();
	}

	/** The currently applied custom dashboard, or `null` for Standard. */
	public get selectedDashboard(): IDashboard | null {
		return this._selectedDashboard$.getValue();
	}

	/** The current user's custom dashboards. */
	public get dashboards(): IDashboard[] {
		return this._dashboards$.getValue();
	}

	/** Triggers a reload of the dashboards list. */
	public refresh(): void {
		this._refresh$.next();
	}

	/** The organization the in-memory dashboard state currently belongs to. */
	private _activeOrganizationId: string | null = null;

	/**
	 * Storage keys are scoped to the current user AND organization so that on a
	 * shared browser (or after an organization switch) one context's selection
	 * or layout backup can never leak into another's session.
	 */
	private _selectedKeyFor(organizationId: string | null | undefined): string {
		return `${SELECTED_DASHBOARD_KEY}_${this._store.userId ?? 'anonymous'}_${organizationId ?? 'no-org'}`;
	}

	private _backupKeyFor(organizationId: string | null | undefined): string {
		return `${STANDARD_LAYOUT_BACKUP_KEY}_${this._store.userId ?? 'anonymous'}_${organizationId ?? 'no-org'}`;
	}

	private get _selectedKey(): string {
		return this._selectedKeyFor(this._store.selectedOrganization?.id);
	}

	private get _backupKey(): string {
		return this._backupKeyFor(this._store.selectedOrganization?.id);
	}

	/*
	|--------------------------------------------------------------------------
	| Loading
	|--------------------------------------------------------------------------
	*/

	private _listenToChangesAndLoadDashboards(): void {
		combineLatest([
			this._store.selectedOrganization$.pipe(filter((organization) => !!organization)),
			this._refresh$.pipe(startWith(null))
		])
			.pipe(
				// Catch load errors INSIDE the switchMap so a failed request
				// does not complete the outer stream (future reloads keep working).
				// A failure emits `null` (NOT []) so it can't be mistaken for
				// "the user has no dashboards" downstream.
				switchMap(([organization]) => {
					// Organization switch: restore the OUTGOING organization's
					// Standard snapshot (its keys, not the new org's) and clear
					// all in-memory dashboard state BEFORE loading, so stale
					// cross-organization chips/selection are never usable —
					// even if the load below fails.
					const organizationId = organization.id as string;
					if (this._activeOrganizationId && this._activeOrganizationId !== organizationId) {
						this._leaveOrganization(this._activeOrganizationId);
					}
					this._activeOrganizationId = organizationId;
					return from(this._loadDashboards()).pipe(
						catchError((error) => {
							console.error('Error loading custom dashboards', error);
							return of(null as IDashboard[] | null);
						})
					);
				}),
				untilDestroyed(this)
			)
			.subscribe((items: IDashboard[] | null) => {
				if (items === null) {
					// Transient load failure: keep the current list and selection —
					// reconciling against [] would wrongly treat the active custom
					// dashboard as deleted and silently kick the user to Standard.
					return;
				}
				this._dashboards$.next(items);
				this._reconcileSelection(items);
			});
	}

	/**
	 * Leaves the given organization's dashboard context: restores its Standard
	 * layout snapshot (when a custom dashboard was active there), removes its
	 * persisted keys and resets the in-memory list/selection.
	 */
	private _leaveOrganization(organizationId: string): void {
		const selectedKey = this._selectedKeyFor(organizationId);
		const backupKey = this._backupKeyFor(organizationId);
		if (this.selectedDashboard || localStorage.getItem(selectedKey)) {
			let layout: IDashboardLayout = {};
			try {
				layout = JSON.parse(localStorage.getItem(backupKey) || '{}') as IDashboardLayout;
			} catch {
				layout = {};
			}
			this._store.widgets = (Array.isArray(layout.widgets) ? layout.widgets : []) as any[];
			this._store.windows = (Array.isArray(layout.windows) ? layout.windows : []) as any[];
		}
		localStorage.removeItem(selectedKey);
		localStorage.removeItem(backupKey);
		// Cross-organization teardown: a staged canvas document belongs to the
		// outgoing organization and must never be saved into the new one.
		this._pendingLayout = null;
		this._selectedDashboard$.next(null);
		this._editing$.next(false);
		this._dashboards$.next([]);
	}

	/**
	 * Loads the current user's dashboards for the selected organization.
	 * Dashboards are personal, so results are scoped to the creating user.
	 */
	private async _loadDashboards(): Promise<IDashboard[]> {
		const { id: organizationId, tenantId } = this._store.selectedOrganization || {};
		const createdByUserId = this._store.userId;

		if (!organizationId || !createdByUserId) {
			return [];
		}

		const { items = [] } = await this._dashboardService.findAll({
			where: { organizationId, tenantId, createdByUserId }
		});

		// Keep only dashboards that hold a serialized widget layout. Seeded /
		// legacy rows (e.g. the demo "Default Dashboard" with HTML content)
		// are not custom layout dashboards and must not surface in the
		// switcher or hijack the default-dashboard redirect.
		return items.filter((item: IDashboard) => this._isLayoutDashboard(item));
	}

	/**
	 * Keeps the selected dashboard reference in sync with the freshly loaded list
	 * (e.g. after rename) and clears a stale selection when the dashboard is gone.
	 */
	private _reconcileSelection(items: IDashboard[]): void {
		const selectedId = this.selectedDashboard?.id ?? localStorage.getItem(this._selectedKey);
		if (!selectedId) {
			return;
		}

		const match = items.find((item: IDashboard) => item.id === selectedId);
		if (match) {
			this._selectedDashboard$.next(match);
		} else if (this.selectedDashboard) {
			// The selected dashboard no longer exists (e.g. deleted elsewhere)
			this.ensureStandardLayout();
		} else {
			// Stale persisted selection with no in-memory counterpart (e.g. the
			// dashboard was deleted in another session) — drop it so it can't
			// resurface later.
			localStorage.removeItem(this._selectedKey);
		}
	}

	/*
	|--------------------------------------------------------------------------
	| Selection & layout application
	|--------------------------------------------------------------------------
	*/

	/**
	 * Applies the custom dashboard with the given ID: snapshots the Standard
	 * layout (when leaving Standard), writes the dashboard's saved layout into
	 * the widget system state and marks the dashboard as selected.
	 *
	 * Used by the `custom/:id` route guard BEFORE the widget host component
	 * initializes, so the layout components pick up the applied state.
	 *
	 * For a v2 (builder) dashboard nothing is written into the legacy widget
	 * state — it renders on the canvas — but the Standard snapshot is still
	 * taken so returning to Standard restores the untouched arrangement.
	 *
	 * @param id - The dashboard ID to apply.
	 * @throws When the dashboard cannot be found.
	 */
	public async selectById(id: ID): Promise<IDashboard> {
		let dashboard = this.dashboards.find((item: IDashboard) => item.id === id);
		if (!dashboard) {
			// Not in the loaded list yet (e.g. navigating right after create,
			// before the refresh round-trip): reload and search again.
			const items = await this._loadDashboards();
			this._dashboards$.next(items);
			dashboard = items.find((item: IDashboard) => item.id === id);
		}
		if (!dashboard) {
			throw new Error(`Dashboard with id ${id} not found`);
		}

		// Preserve the Standard layout before the first custom dashboard is applied
		this._snapshotStandardIfNeeded();

		// Apply the saved layout into the widget system state (v1 only — see _applyLayout)
		this._applyLayout(dashboard.contentHtml);

		// Switching dashboards drops anything the canvas staged for the previous one
		this._pendingLayout = null;

		// Persist and publish the selection
		localStorage.setItem(this._selectedKey, dashboard.id as string);
		this._selectedDashboard$.next(dashboard);
		this._editing$.next(false);

		return dashboard;
	}

	/**
	 * Restores the Standard dashboard layout if a custom dashboard was active.
	 * Invoked by a guard on the standard dashboard tab routes, so it is safe to
	 * call repeatedly (no-op when Standard is already active).
	 */
	public ensureStandardLayout(): void {
		const selectedId = localStorage.getItem(this._selectedKey);
		if (!selectedId && !this.selectedDashboard) {
			return;
		}

		this._restoreStandardSnapshot();
		localStorage.removeItem(this._selectedKey);
		this._pendingLayout = null;
		this._selectedDashboard$.next(null);
		this._editing$.next(false);
	}

	/**
	 * Resolves the user's default custom dashboard (if any).
	 * Used to decide where `/pages/dashboard` should land.
	 */
	public async resolveDefaultDashboard(): Promise<IDashboard | null> {
		const { id: organizationId, tenantId } = this._store.selectedOrganization || {};
		const createdByUserId = this._store.userId;
		// The custom dashboard experience is organization-scoped: without a
		// selected organization the query could surface a default dashboard
		// from ANOTHER organization — land on Standard instead. Guard BEFORE
		// the cached-list fast path so a stale cross-organization cache can't
		// short-circuit the check during an organization switch.
		if (!createdByUserId || !organizationId) {
			return null;
		}

		const loaded = this.dashboards.find(
			(item: IDashboard) => item.isDefault && item.organizationId === organizationId
		);
		if (loaded) {
			return loaded;
		}

		// Note: the default flag is filtered client-side to avoid boolean
		// serialization differences across the supported databases.
		const { items = [] } = await this._dashboardService.findAll({
			where: {
				organizationId,
				...(tenantId ? { tenantId } : {}),
				createdByUserId
			}
		});

		return items.find((item: IDashboard) => item.isDefault && this._isLayoutDashboard(item)) ?? null;
	}

	/*
	|--------------------------------------------------------------------------
	| Navigation helpers
	|--------------------------------------------------------------------------
	*/

	/** Navigates to the given custom dashboard (the route guard applies its layout). */
	public navigateToDashboard(id: ID): void {
		this._router.navigate(['/pages/dashboard/custom', id]);
	}

	/** Navigates to the Standard dashboard (the route guard restores the standard layout). */
	public navigateToStandard(): void {
		this._router.navigate(['/pages/dashboard/time-tracking']);
	}

	/*
	|--------------------------------------------------------------------------
	| CRUD operations
	|--------------------------------------------------------------------------
	*/

	/**
	 * Creates a new custom dashboard.
	 *
	 * A brand new dashboard starts as an EMPTY v2 builder document (a single
	 * empty tab): the product requirement is a blank canvas the user fills from
	 * the widget palette, not a copy of the Standard arrangement.
	 *
	 * @param name - Display name of the dashboard.
	 * @param layout - Explicit initial layout (used by Duplicate, which carries
	 *   over the source document); `null` creates the empty v2 canvas.
	 */
	public async createDashboard(name: string, layout: DashboardLayout | null = null): Promise<IDashboard> {
		const { id: organizationId, tenantId } = this._store.selectedOrganization || {};

		const dashboard = await this._dashboardService.create({
			name,
			identifier: this._slugify(name),
			// An explicit layout is persisted verbatim so duplicating a legacy
			// v1 dashboard still yields a v1 dashboard. Either shape carries the
			// marker keys that make the row a custom layout dashboard
			// (`version`/`tabs` or `widgets`/`windows` — see _isLayoutDashboard).
			contentHtml: (layout ?? normalizeLayout({})) as JsonData,
			organizationId,
			tenantId,
			...(this._store.user?.employee?.id ? { employeeId: this._store.user.employee.id } : {})
		});

		this.refresh();
		return dashboard;
	}

	/**
	 * Duplicates the given dashboard (or the current live layout when
	 * duplicating the Standard dashboard).
	 *
	 * A v2 (builder) source is deep-cloned with FRESH tab and placement ids so
	 * the copy is fully independent — sharing ids would make the two dashboards
	 * collide in any instance-keyed state (widget config, selection, drag).
	 *
	 * @param source - The dashboard to duplicate, or `null` to duplicate the
	 *   currently applied (Standard) layout.
	 * @param name - Name for the copy.
	 */
	public async duplicateDashboard(source: IDashboard | null, name: string): Promise<IDashboard> {
		if (!source) {
			// Duplicating Standard snapshots the live legacy widget state (v1).
			return this.createDashboard(name, this.captureLayout());
		}

		const layout = parseLayout(source.contentHtml);
		if (isLayoutV2(layout)) {
			return this.createDashboard(name, this._cloneLayoutV2(normalizeLayout(layout)));
		}

		// A v1 source is copied verbatim, but only when it actually carries the
		// marker keys: persisting a marker-less document would create a row that
		// _isLayoutDashboard filters out, so the copy would vanish from the
		// switcher and the navigation right after it would fail with "not found".
		const hasV1Markers = 'widgets' in layout || 'windows' in layout;
		return this.createDashboard(name, hasV1Markers ? layout : null);
	}

	/** Renames the given dashboard. */
	public async renameDashboard(dashboard: IDashboard, name: string): Promise<IDashboard> {
		const updated = await this._dashboardService.update(dashboard.id, { name });
		this.refresh();
		return updated;
	}

	/** Marks the given dashboard as the user's default one. */
	public async setDefaultDashboard(dashboard: IDashboard): Promise<IDashboard> {
		const updated = await this._dashboardService.update(dashboard.id, { isDefault: true });
		this.refresh();
		return updated;
	}

	/** Clears the default flag from all of the user's dashboards (Standard becomes the default again). */
	public async clearDefaultDashboard(): Promise<void> {
		const defaults = this.dashboards.filter((item: IDashboard) => item.isDefault);
		await Promise.all(
			defaults.map((item: IDashboard) => this._dashboardService.update(item.id, { isDefault: false }))
		);
		this.refresh();
	}

	/**
	 * Deletes the given dashboard. When it is the currently applied one, the
	 * Standard layout is restored and the user is navigated back to Standard.
	 */
	public async deleteDashboard(dashboard: IDashboard): Promise<void> {
		await this._dashboardService.delete(dashboard.id);

		if (this.selectedDashboard?.id === dashboard.id) {
			this.ensureStandardLayout();
			this.navigateToStandard();
		}

		this.refresh();
	}

	/*
	|--------------------------------------------------------------------------
	| Edit mode
	|--------------------------------------------------------------------------
	*/

	/** Enters edit (arrange) mode for the currently selected custom dashboard. */
	public startEditing(): void {
		if (this.selectedDashboard) {
			this._editing$.next(true);
		}
	}

	/**
	 * Persists the current live widget layout into the selected custom dashboard.
	 *
	 * For a v2 (builder) dashboard the live widget state is NOT the dashboard's
	 * content, so the document staged by the canvas is saved instead; capturing
	 * `Store.widgets`/`Store.windows` here would overwrite the builder document
	 * with an unrelated legacy snapshot.
	 */
	public async saveSelectedLayout(): Promise<IDashboard | null> {
		const selected = this.selectedDashboard;
		if (!selected) {
			return null;
		}

		if (this.isBuilderDashboard(selected)) {
			const pending = this._pendingLayout;
			// Nothing staged (canvas already persisted, or no changes): leaving
			// edit mode is all that is left to do.
			const saved = pending ? await this.saveLayoutV2(selected.id, pending) : selected;
			// Leave edit mode only once the write succeeded — a rejected save must
			// keep the user in the editor (Save / Discard still reachable) with the
			// staged document intact, exactly like the v1 branch below.
			this._editing$.next(false);
			return saved;
		}

		const updated = await this._dashboardService.update(selected.id, {
			contentHtml: this.captureLayout() as JsonData
		});

		this._editing$.next(false);
		this._selectedDashboard$.next({ ...selected, contentHtml: updated?.contentHtml ?? this.captureLayout() });
		this.refresh();

		return updated;
	}

	/**
	 * Discards unsaved layout changes: re-applies the persisted layout of the
	 * selected dashboard and reloads the widget host route.
	 */
	public cancelEditing(): void {
		const selected = this.selectedDashboard;
		this._editing$.next(false);
		// Drop the staged canvas document — discarding means the persisted one wins.
		this._pendingLayout = null;

		if (selected) {
			this._applyLayout(selected.contentHtml);
			// Reload the route through an intermediate componentless hop so the
			// widget host components re-create and pick up the restored state
			// (a same-URL navigation would be ignored by the router).
			void this._router
				.navigateByUrl('/pages/dashboard/switching', { skipLocationChange: true })
				.then(() => this._router.navigate(['/pages/dashboard/custom', selected.id]));
		}
	}

	/*
	|--------------------------------------------------------------------------
	| Builder documents (v2)
	|--------------------------------------------------------------------------
	*/

	/**
	 * Reads a dashboard's persisted content as a v2 (builder) document.
	 *
	 * ALWAYS returns a v2 document: a legacy v1 snapshot (or empty/corrupt
	 * content) is normalized into a single empty tab while its original payload
	 * is preserved, so the canvas can render any dashboard without special
	 * casing. Use {@link isBuilderDashboard} to tell the two apart.
	 *
	 * @param dashboard - The dashboard to read (tolerates `null`).
	 * @returns A normalized, grid-clamped v2 document.
	 */
	public getLayout(dashboard: IDashboard | null | undefined): IDashboardLayoutV2 {
		return normalizeLayout(parseLayout(dashboard?.contentHtml));
	}

	/**
	 * Persists a v2 (builder) document into the given dashboard.
	 *
	 * @param dashboardId - The dashboard to write to.
	 * @param layout - The document produced by the canvas.
	 * @returns The updated dashboard.
	 */
	public async saveLayoutV2(dashboardId: ID, layout: IDashboardLayoutV2): Promise<IDashboard> {
		// Normalize on the way out so a canvas bug can never persist tabs without
		// ids or geometry outside the 12 column grid.
		const normalized = normalizeLayout(layout);
		const updated = await this._dashboardService.update(dashboardId, {
			contentHtml: normalized as JsonData
		});

		// The write is now the source of truth: drop the staged copy and refresh
		// the in-memory selection so later reads (cancelEditing, getLayout) do
		// not see the pre-save content.
		this._pendingLayout = null;
		const selected = this.selectedDashboard;
		if (selected?.id === dashboardId) {
			this._selectedDashboard$.next({
				...selected,
				contentHtml: (updated?.contentHtml ?? normalized) as JsonData
			});
		}

		this.refresh();
		return updated;
	}

	/**
	 * Stages the canvas' in-progress document so the switcher's Save / Discard
	 * buttons — which hold no reference to the canvas — act on it.
	 *
	 * @param layout - The working document, or `null` once there is nothing unsaved.
	 */
	public stagePendingLayout(layout: IDashboardLayoutV2 | null): void {
		this._pendingLayout = layout;
	}

	/**
	 * Whether the dashboard is a v2 builder document (rendered on the canvas)
	 * rather than a legacy v1 widget snapshot.
	 *
	 * @param dashboard - The dashboard to test.
	 */
	public isBuilderDashboard(dashboard: IDashboard | null | undefined): boolean {
		return isLayoutV2(parseLayout(dashboard?.contentHtml));
	}

	/**
	 * Deep-clones a v2 document, re-generating every tab and placement id.
	 *
	 * Per-instance `config` objects are cloned too, so editing the copy can
	 * never mutate the source dashboard's persisted settings.
	 *
	 * @param layout - The (already normalized) document to clone.
	 */
	private _cloneLayoutV2(layout: IDashboardLayoutV2): IDashboardLayoutV2 {
		return {
			...layout,
			version: 2,
			tabs: (layout.tabs ?? []).map(
				(tab: IDashboardTab): IDashboardTab => ({
					...tab,
					id: createId(),
					widgets: (tab.widgets ?? []).map(
						(placement: IDashboardWidgetPlacement): IDashboardWidgetPlacement => ({
							...placement,
							instanceId: createId(),
							...(placement.config ? { config: this._deepClone(placement.config) } : {})
						})
					)
				})
			)
		};
	}

	/**
	 * Structural clone through JSON — the same round-trip the value goes through
	 * when persisted, so anything that survives here survives a save.
	 */
	private _deepClone<T>(value: T): T {
		try {
			return JSON.parse(JSON.stringify(value)) as T;
		} catch {
			// Non-serializable (e.g. circular) config: keep the reference rather
			// than losing the widget's settings entirely.
			return value;
		}
	}

	/*
	|--------------------------------------------------------------------------
	| Layout (de)serialization
	|--------------------------------------------------------------------------
	*/

	/**
	 * Captures the current live widget layout (as maintained by the existing
	 * widget system in `Store.widgets` / `Store.windows`).
	 */
	public captureLayout(): IDashboardLayout {
		return {
			widgets: this._sanitizeLayoutItems(this._store.widgets),
			windows: this._sanitizeLayoutItems(this._store.windows)
		};
	}

	/**
	 * Writes the given saved layout into the legacy widget system state.
	 *
	 * v2 (builder) documents are skipped: they render on the canvas, and their
	 * `widgets`/`windows` keys are either absent (so the live Standard
	 * arrangement would be wiped) or a stale pre-migration snapshot.
	 */
	private _applyLayout(content: JsonData | undefined): void {
		const layout = parseLayout(content);
		if (isLayoutV2(layout)) {
			return;
		}
		// Validate shapes — malformed/hand-edited content must not crash the widget host
		this._store.widgets = (Array.isArray(layout.widgets) ? layout.widgets : []) as any[];
		this._store.windows = (Array.isArray(layout.windows) ? layout.windows : []) as any[];
	}

	/**
	 * Whether the dashboard row holds a serialized widget layout (i.e. was
	 * created by this feature) — either a v2 builder document or a v1 snapshot.
	 * Seeded/legacy rows store arbitrary HTML in `contentHtml` and are excluded
	 * from the custom dashboard experience.
	 *
	 * v2 documents MUST be recognized here: they carry no `widgets`/`windows`
	 * keys, so a v1-only check would filter every builder dashboard out of the
	 * switcher and out of the default-dashboard redirect.
	 */
	private _isLayoutDashboard(item: IDashboard): boolean {
		const layout = parseLayout(item?.contentHtml);
		return isLayoutV2(layout) || 'widgets' in layout || 'windows' in layout;
	}

	/** Keeps only the serializable `GuiDrag` fields of each layout item. */
	private _sanitizeLayoutItems(items: any[] | undefined): IDashboardLayoutItem[] {
		return (items ?? [])
			.filter((item: any) => !!item && typeof item.position === 'number')
			.map((item: any) => ({
				position: item.position,
				title: item.title,
				hide: item.hide,
				isCollapse: item.isCollapse,
				isExpand: item.isExpand
			}));
	}

	/** Snapshots the Standard layout once, before the first custom dashboard is applied. */
	private _snapshotStandardIfNeeded(): void {
		const alreadyCustom = !!localStorage.getItem(this._selectedKey);
		if (alreadyCustom) {
			return;
		}
		const snapshot = this.captureLayout();
		localStorage.setItem(this._backupKey, JSON.stringify(snapshot));
	}

	/** Restores the Standard layout snapshot into the widget system state. */
	private _restoreStandardSnapshot(): void {
		let layout: IDashboardLayout = {};
		try {
			layout = JSON.parse(localStorage.getItem(this._backupKey) || '{}') as IDashboardLayout;
		} catch {
			layout = {};
		}
		this._store.widgets = (Array.isArray(layout.widgets) ? layout.widgets : []) as any[];
		this._store.windows = (Array.isArray(layout.windows) ? layout.windows : []) as any[];
		localStorage.removeItem(this._backupKey);
	}

	/** Builds a unique identifier (slug) for a dashboard name. */
	private _slugify(name: string): string {
		const base = name
			.toLowerCase()
			.trim()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '');
		return `${base || 'dashboard'}-${Date.now()}`;
	}
}
