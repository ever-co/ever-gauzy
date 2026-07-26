import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, combineLatest, from, of, Subject } from 'rxjs';
import { catchError, filter, startWith, switchMap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { ID, IDashboard, IDashboardLayout, IDashboardLayoutItem, JsonData } from '@gauzy/contracts';
import { DashboardService } from './dashboard.service';
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

		// Apply the saved layout into the widget system state
		this._applyLayout(dashboard.contentHtml);

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
	 * @param name - Display name of the dashboard.
	 * @param layout - Initial layout; pass `null` for the default arrangement
	 *   (every widget visible in its declared position).
	 */
	public async createDashboard(name: string, layout: IDashboardLayout | null = null): Promise<IDashboard> {
		const { id: organizationId, tenantId } = this._store.selectedOrganization || {};

		const dashboard = await this._dashboardService.create({
			name,
			identifier: this._slugify(name),
			// Always persist the layout marker keys so the row is recognized
			// as a custom layout dashboard (see _isLayoutDashboard).
			contentHtml: (layout ?? { widgets: [], windows: [] }) as JsonData,
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
	 * @param source - The dashboard to duplicate, or `null` to duplicate the
	 *   currently applied (Standard) layout.
	 * @param name - Name for the copy.
	 */
	public async duplicateDashboard(source: IDashboard | null, name: string): Promise<IDashboard> {
		const layout = source ? this._parseLayout(source.contentHtml) : this.captureLayout();
		return this.createDashboard(name, layout);
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
	 */
	public async saveSelectedLayout(): Promise<IDashboard | null> {
		const selected = this.selectedDashboard;
		if (!selected) {
			return null;
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

	/** Writes the given saved layout into the widget system state. */
	private _applyLayout(content: JsonData | undefined): void {
		const layout = this._parseLayout(content);
		// Validate shapes — malformed/hand-edited content must not crash the widget host
		this._store.widgets = (Array.isArray(layout.widgets) ? layout.widgets : []) as any[];
		this._store.windows = (Array.isArray(layout.windows) ? layout.windows : []) as any[];
	}

	/**
	 * Whether the dashboard row holds a serialized widget layout (i.e. was
	 * created by this feature). Seeded/legacy rows store arbitrary HTML in
	 * `contentHtml` and are excluded from the custom dashboard experience.
	 */
	private _isLayoutDashboard(item: IDashboard): boolean {
		const content = item?.contentHtml as JsonData | undefined;
		if (!content) {
			return false;
		}
		let parsed: unknown = content;
		if (typeof content === 'string') {
			try {
				parsed = JSON.parse(content);
			} catch {
				return false;
			}
		}
		return !!parsed && typeof parsed === 'object' && ('widgets' in (parsed as object) || 'windows' in (parsed as object));
	}

	/** Parses a dashboard `contentHtml` payload into a layout object. */
	private _parseLayout(content: JsonData | undefined): IDashboardLayout {
		if (!content) {
			return {};
		}
		let parsed: unknown = content;
		if (typeof content === 'string') {
			try {
				parsed = JSON.parse(content);
			} catch {
				return {};
			}
		}
		// Normalize: a null/array/primitive root (e.g. the string "null") must
		// not reach _applyLayout, which reads `.widgets` off the result.
		if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
			return {};
		}
		return parsed as IDashboardLayout;
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
