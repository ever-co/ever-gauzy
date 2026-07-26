import { ChangeDetectorRef, Component, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { IDashboard, IDashboardLayoutV2, IDashboardTab, IDashboardWidgetPlacement } from '@gauzy/contracts';
import { createId, DashboardStoreService, normalizeLayout, parseLayout } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { DashboardCanvasComponent } from './dashboard-canvas.component';

/**
 * Host page of a custom dashboard (route `custom/:id`).
 *
 * Reads the applied dashboard from {@link DashboardStoreService} (the route guard
 * selects it before activation), normalizes its persisted `contentHtml` into a v2
 * builder document, and renders the tab strip, the active tab's canvas and — in
 * edit mode — the widget palette.
 *
 * The active tab lives in the `?tab=<tabId>` query parameter, so a tab is
 * deep-linkable and survives a reload.
 *
 * Saving is NOT done here: every change is staged on the dashboard store, which
 * is what the switcher's Save / Discard buttons act on. Keeping a single pair of
 * buttons avoids two competing "save" controls on the same screen.
 */
@UntilDestroy()
@Component({
	selector: 'ga-custom-dashboard',
	templateUrl: './custom-dashboard.component.html',
	styleUrls: ['./custom-dashboard.component.scss'],
	standalone: false
})
export class CustomDashboardComponent extends TranslationBaseComponent implements OnInit {
	/** The dashboard currently applied by the route guard. */
	public dashboard: IDashboard | null = null;

	/** The normalized (v2) builder document being displayed/edited. */
	public layout: IDashboardLayoutV2 = normalizeLayout(null);

	/** Id of the tab currently rendered. */
	public activeTabId: string | null = null;

	/** Edit (arrange) mode, owned by the dashboard store. */
	public editing = false;

	/** Whether the document has changes that have not been saved yet. */
	public dirty = false;

	/** Tab id requested through the URL, applied as soon as the layout is known. */
	private _requestedTabId: string | null = null;

	@ViewChild(DashboardCanvasComponent) private readonly _canvas?: DashboardCanvasComponent;

	constructor(
		public readonly translateService: TranslateService,
		private readonly _route: ActivatedRoute,
		private readonly _router: Router,
		private readonly _dashboardStore: DashboardStoreService,
		private readonly _changeRef: ChangeDetectorRef
	) {
		super(translateService);
	}

	ngOnInit(): void {
		combineLatest([this._route.paramMap, this._dashboardStore.selectedDashboard$])
			.pipe(
				map(([params, selected]) => ({ id: params.get('id'), selected })),
				untilDestroyed(this)
			)
			.subscribe(({ id, selected }) => {
				// Ignore selections for another dashboard: while navigating between
				// two custom dashboards the route param and the store selection are
				// momentarily out of sync.
				if (!selected || (id && selected.id !== id)) {
					return;
				}
				this._hydrate(selected);
			});

		this._route.queryParamMap
			.pipe(
				map((params) => params.get('tab')),
				untilDestroyed(this)
			)
			.subscribe((tabId: string | null) => {
				this._requestedTabId = tabId;
				this._applyActiveTab();
			});

		this._dashboardStore.editing$.pipe(untilDestroyed(this)).subscribe((editing: boolean) => {
			// Leaving edit mode means the switcher has either saved the staged
			// document or discarded it — either way nothing of ours is pending any
			// more. Without clearing the flag here it would stay set forever, and
			// `_hydrate()` (which skips hydration while dirty, to protect an
			// in-progress arrangement) would never read the freshly saved layout
			// back in.
			if (this.editing && !editing) {
				this.dirty = false;
			}
			this.editing = editing;
			this._changeRef.markForCheck();
		});
	}

	/** The tab currently rendered on the canvas. */
	public get activeTab(): IDashboardTab | null {
		return this.layout.tabs.find((tab: IDashboardTab) => tab.id === this.activeTabId) ?? null;
	}

	/*
	|--------------------------------------------------------------------------
	| Tab strip
	|--------------------------------------------------------------------------
	*/

	/**
	 * Switches to a tab and mirrors it into the `?tab=` query parameter.
	 *
	 * @param tabId - Id of the tab to display.
	 */
	public onSelectTab(tabId: string): void {
		this.activeTabId = tabId;
		void this._router.navigate([], {
			relativeTo: this._route,
			queryParams: { tab: tabId },
			queryParamsHandling: 'merge',
			// A tab switch is not a history entry — Back should leave the dashboard
			replaceUrl: true
		});
	}

	/**
	 * Appends a new empty tab and switches to it.
	 *
	 * @param name - Name entered by the user.
	 */
	public onAddTab(name: string): void {
		const tab: IDashboardTab = { id: createId(), name, order: this.layout.tabs.length, widgets: [] };
		this._updateTabs([...this.layout.tabs, tab]);
		this.onSelectTab(tab.id);
	}

	/**
	 * Renames a tab.
	 *
	 * @param payload - The tab and its new name.
	 */
	public onRenameTab(payload: { tab: IDashboardTab; name: string }): void {
		this._updateTabs(
			this.layout.tabs.map((tab: IDashboardTab) =>
				tab.id === payload.tab.id ? { ...tab, name: payload.name } : tab
			)
		);
	}

	/**
	 * Duplicates a tab, including its widgets, and switches to the copy.
	 *
	 * Every copied placement gets a fresh `instanceId`, otherwise the two tabs
	 * would share widget identities and their configuration would collide.
	 *
	 * @param tab - The tab to duplicate.
	 */
	public onDuplicateTab(tab: IDashboardTab): void {
		const copy: IDashboardTab = {
			...tab,
			id: createId(),
			name: `${tab.name} ${this.getTranslation('DASHBOARD_PAGE.BUILDER.TABS.COPY_SUFFIX')}`,
			order: this.layout.tabs.length,
			widgets: (tab.widgets ?? []).map((placement: IDashboardWidgetPlacement) => ({
				...placement,
				instanceId: createId(),
				config: placement.config ? { ...placement.config } : undefined
			}))
		};
		this._updateTabs([...this.layout.tabs, copy]);
		this.onSelectTab(copy.id);
	}

	/**
	 * Deletes a tab (the strip already confirmed with the user) and activates a
	 * neighboring tab when the deleted one was displayed.
	 *
	 * @param tab - The tab to delete.
	 */
	public onDeleteTab(tab: IDashboardTab): void {
		// A dashboard always keeps at least one canvas
		if (this.layout.tabs.length <= 1) {
			return;
		}
		const index = this.layout.tabs.findIndex((item: IDashboardTab) => item.id === tab.id);
		const tabs = this.layout.tabs
			.filter((item: IDashboardTab) => item.id !== tab.id)
			.map((item: IDashboardTab, order: number) => ({ ...item, order }));

		this._updateTabs(tabs);

		if (this.activeTabId === tab.id) {
			this.onSelectTab(tabs[Math.min(Math.max(index, 0), tabs.length - 1)].id);
		}
	}

	/**
	 * Applies a drag-reordered tab list.
	 *
	 * @param tabs - The tabs in their new order (already re-numbered).
	 */
	public onReorderTabs(tabs: IDashboardTab[]): void {
		this._updateTabs(tabs);
	}

	/*
	|--------------------------------------------------------------------------
	| Canvas & palette
	|--------------------------------------------------------------------------
	*/

	/**
	 * Stores the new arrangement of the active tab.
	 *
	 * @param placements - The tab's placements after the change.
	 */
	public onLayoutChange(placements: IDashboardWidgetPlacement[]): void {
		const activeId = this.activeTabId;
		if (!activeId) {
			return;
		}
		this._updateTabs(
			this.layout.tabs.map((tab: IDashboardTab) =>
				tab.id === activeId ? { ...tab, widgets: placements } : tab
			)
		);
	}

	/**
	 * Adds a widget clicked in the palette — the keyboard-accessible counterpart
	 * of dragging it onto the canvas.
	 *
	 * @param widgetId - Registry key of the widget to add.
	 */
	public onAddWidget(widgetId: string): void {
		this._canvas?.addWidget(widgetId);
	}

	/*
	|--------------------------------------------------------------------------
	| Internals
	|--------------------------------------------------------------------------
	*/

	/**
	 * Reads the persisted layout of the given dashboard into the page.
	 *
	 * A background reload (e.g. after a rename elsewhere) must not throw away an
	 * in-progress arrangement, so hydration is skipped while the same dashboard
	 * still has unsaved changes.
	 */
	private _hydrate(dashboard: IDashboard): void {
		if (this.dashboard?.id === dashboard.id && this.dirty) {
			this.dashboard = dashboard;
			return;
		}
		this.dashboard = dashboard;
		this.layout = normalizeLayout(
			parseLayout(dashboard.contentHtml),
			this.getTranslation('DASHBOARD_PAGE.BUILDER.TABS.DEFAULT_NAME')
		);
		this.dirty = false;
		// The persisted document is now on screen: nothing is staged any more.
		this._dashboardStore.stagePendingLayout(null);
		this._applyActiveTab();
	}

	/** Resolves the active tab from the URL, falling back to the first tab. */
	private _applyActiveTab(): void {
		const tabs = this.layout?.tabs ?? [];
		const requested = tabs.find((tab: IDashboardTab) => tab.id === this._requestedTabId);
		this.activeTabId = (requested ?? tabs[0])?.id ?? null;
		this._changeRef.markForCheck();
	}

	/**
	 * Replaces the tab list and stages the working document on the dashboard
	 * store, which is what the switcher's Save button persists.
	 */
	private _updateTabs(tabs: IDashboardTab[]): void {
		this.layout = { ...this.layout, tabs };
		this.dirty = true;
		this._dashboardStore.stagePendingLayout(this.layout);
		this._changeRef.markForCheck();
	}
}
