import { ChangeDetectorRef, Component, EventEmitter, inject, Input, OnInit, Output, ViewChild } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router } from '@angular/router';
import {
	NbAccordionModule,
	NbPopoverDirective,
	NbPopoverModule,
	NbSidebarService,
	NbTooltipModule
} from '@nebular/theme';
import { merge } from 'rxjs';
import { filter, take, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { NgxPermissionsModule, NgxPermissionsObject, NgxPermissionsService } from 'ngx-permissions';
import { IUser } from '@gauzy/contracts';
import { IMenuItem, IMenuItemFocusChangeEvent } from '../../interface/menu-item.interface';
import { Store } from '../../../../../services/store/store.service';
import { JitsuService } from '../../../../../services/analytics/jitsu.service';
import { JitsuAnalyticsEvents, JitsuAnalyticsEventsEnum } from '../../../../../services/analytics/event.type';
import { TooltipDirective } from '../../../../../directives/tooltip.directive';
import { ChildrenMenuItemComponent } from '../children-menu-item/children-menu-item.component';

/** Tag of the Nebular sidebar this menu renders into (see one-column.layout.html). */
const MENU_SIDEBAR_TAG = 'menu-sidebar';

@UntilDestroy()
@Component({
	selector: 'ga-menu-item',
	templateUrl: './menu-item.component.html',
	styleUrls: ['./menu-item.component.scss'],
	standalone: true,
	imports: [
		CommonModule,
		NbAccordionModule,
		NbPopoverModule,
		NbTooltipModule,
		NgxPermissionsModule,
		TooltipDirective,
		ChildrenMenuItemComponent
	]
})
export class MenuItemComponent implements OnInit {
	private readonly _router = inject(Router);
	private readonly _sidebarService = inject(NbSidebarService);
	private readonly _cdr = inject(ChangeDetectorRef);
	private readonly _location = inject(Location);
	private readonly _jitsuService = inject(JitsuService);
	private readonly _store = inject(Store);
	private readonly _permissionsService = inject(NgxPermissionsService);

	private _user: IUser;

	/**
	 * Returns the value of the private `_item` property.
	 *
	 * @return {IMenuItem} The value of the `_item` property.
	 */
	private _item: IMenuItem;
	get item() {
		return this._item;
	}
	@Input() set item(value: IMenuItem) {
		this._item = value;
	}

	/**
	 * Returns the current collapse state.
	 *
	 * @return {boolean} The current collapse state.
	 */
	private _collapse = true;
	get collapse() {
		return this._collapse; // Returns the current collapse state
	}

	@Input() set collapse(value) {
		this._collapse = value; // Sets the collapse state to the provided value
	}

	/**
	 * Returns the current selected state.
	 *
	 * @return {boolean} The current selected state.
	 */
	private _selected: boolean;
	get selected() {
		return this._selected;
	}
	@Input() set selected(value: boolean) {
		this._selected = value;
	}

	/**
	 * Returns the current state of the component.
	 *
	 * @return {boolean} The current state of the component.
	 */
	private _state: boolean;
	public get state() {
		return this._state;
	}
	public set state(value) {
		this._state = value;
	}

	/**
	 * Returns the selected children.
	 *
	 * @return {IMenuItem} The selected children.
	 */
	private _selectedChildren: IMenuItem;
	public get selectedChildren() {
		return this._selectedChildren;
	}
	public set selectedChildren(value: IMenuItem) {
		this._selectedChildren = value;
	}

	/**
	 * The hover flyout that lists this entry's sub-links while the sidebar is collapsed to the icon
	 * rail. It only exists on the rail header (see the template), so it is undefined otherwise.
	 */
	@ViewChild(NbPopoverDirective) private readonly _railFlyout: NbPopoverDirective;

	@Output() public collapsedChange: EventEmitter<any> = new EventEmitter();
	@Output() public selectedChange: EventEmitter<any> = new EventEmitter();

	/** Last list handed out by `visibleChildren`, kept so the reference only changes with the list. */
	private _visibleChildren: IMenuItem[] = [];

	/**
	 * The child entries that actually reach the screen.
	 *
	 * Both the accordion body and the rail flyout render from this, and `hasChildren` is derived
	 * from it, so the sub-menu is only ever offered when there is something in it: a parent whose
	 * children are all hidden or all barred by permissions used to open an EMPTY flyout.
	 *
	 * Computed on read rather than cached at `item` set time because neither trigger is an input
	 * change: NavMenuBuilderService splices and pushes into the SAME `children` array when reports
	 * or organization items come and go, and permissions arrive later still (pages.component loads
	 * them from `userRolePermissions$`). The array itself is only swapped when its contents differ,
	 * which keeps the template's binding identity stable across change-detection passes.
	 *
	 * @return {IMenuItem[]} The children that pass the same visibility and permission filtering as
	 * the rendered rows.
	 */
	public get visibleChildren(): IMenuItem[] {
		const children = (this.item?.children ?? []) as IMenuItem[];
		const permissions = this._permissionsService.getPermissions();
		const next = children.filter((child: IMenuItem) => !child?.hidden && this.isAuthorized(child, permissions));

		const changed =
			next.length !== this._visibleChildren.length ||
			next.some((child: IMenuItem, index: number) => child !== this._visibleChildren[index]);
		if (changed) {
			this._visibleChildren = next;
		}
		return this._visibleChildren;
	}

	/**
	 * Whether this entry owns a sub-menu worth opening.
	 *
	 * @return {boolean} True when the item has at least one child entry that renders.
	 */
	public get hasChildren(): boolean {
		return this.visibleChildren.length > 0;
	}

	ngOnInit(): void {
		// Get the user data from the store
		this._user = this._store.user;

		// Track the sidebar's expanded/collapsed state (the template hides labels when collapsed).
		//
		// `NbSidebarService.getSidebarState()` is a one-shot QUERY, not a live stream: Nebular's own
		// doc says it "emits once", and NbSidebarComponent answers each request with a single
		// `observer.next(this.state)`. That is why the original code re-ran it inside
		// ngAfterViewChecked — re-querying on every change-detection pass was what kept `state` fresh.
		//
		// The cost of that was severe. Each pass opened a NEW, never-unsubscribed subscription, and
		// each getSidebarState() call allocates a ReplaySubject and pushes it onto a module-level
		// Subject that Nebular broadcasts synchronously to EVERY mounted sidebar — so the work was
		// app-wide, not local, and multiplied by the dozens of menu items in the tree. Subscriptions
		// grew without bound for as long as the app stayed open, making change detection steadily more
		// expensive until clicks stopped getting a frame. The detectChanges() call was re-entrant too:
		// running it from inside ngAfterViewChecked can schedule the very check that re-enters the hook.
		//
		// Re-query only when the sidebar ACTUALLY changes. Every path that changes it today goes
		// through the service — the layout's toggle()/expand(), header.component, and this component's
		// own toggle below — and getSidebarState() is answered by whichever NbSidebarComponent carries
		// the tag, wherever it is mounted, which is why this also works for the menu rendered in the
		// workspace-menu overlay (outside nb-layout, inside no sidebar at all). Ordering is safe
		// because that tagged sidebar is created with the layout at boot, before any menu item renders.
		//
		// CAVEAT, deliberately not enforced here: this assumes the sidebar is not `responsive`.
		// Nebular's subscribeToMediaQueryChange() and the `responsive` setter call
		// compact()/collapse()/expand() on the component DIRECTLY, never through the service subjects,
		// so a responsive sidebar would leave this value permanently stale. one-column.layout.html —
		// the layout actually in use — does not set it, but two-columns/three-columns.layout.ts DO
		// declare `<nb-sidebar class="menu-sidebar" tag="menu-sidebar" responsive>`. They are currently
		// unreachable, but they are exported from ThemeModule, so if one is ever wired up this needs to
		// move to deriving the value from NbSidebarComponent's `(stateChange)` output, which
		// updateState() emits on EVERY path including the responsive ones.
		this.syncSidebarState();
		merge(
			this._sidebarService.onToggle(),
			this._sidebarService.onExpand(),
			this._sidebarService.onCollapse(),
			this._sidebarService.onCompact()
		)
			.pipe(
				// Tagged-only, matching how NbSidebarComponent itself filters: a sidebar that HAS a tag
				// ignores untagged events, so reacting to them here would just re-query for nothing.
				filter(({ tag }) => tag === MENU_SIDEBAR_TAG),
				untilDestroyed(this)
			)
			.subscribe(() => this.syncSidebarState());

		// Check if the 'home' property of the 'item' object is truthy
		if (this.item.home) {
			// If 'home' is truthy, emit an event to notify the parent component
			// This emits the 'selectedChange' event with the 'item' as the data
			this.selectedChange.emit(this.item);
		}
	}

	/**
	 * Handles the collapse event.
	 * @param event A boolean indicating whether the item should collapse or not.
	 */
	public onCollapse(event: boolean): void {
		// Update the collapse state based on the event
		this.collapse = event;
	}

	/**
	 * Focuses on a specific item.
	 * @param event The event containing information about the item to focus on.
	 */
	public focusOn(event: IMenuItemFocusChangeEvent): void {
		// Set the selected children property to the children of the event
		this.selectedChildren = event.children;

		// Toggle the collapse state if it's currently collapsed
		if (this.collapse) {
			this.collapse = !this.collapse;
		}

		// Emit the selectedChange event with the parent of the event
		this.selectedChange.emit(event.parent);

		// Manually detect changes using ChangeDetectorRef
		this._cdr.detectChanges();
	}

	/**
	 * Dismiss the rail flyout.
	 *
	 * Bound to a CLICK on the flyout's row list rather than to `focusItemChange`: a child row also
	 * emits that event from its own `ngOnInit`/`NavigationEnd` handler, so hiding on it would close
	 * the panel the moment it opened on any entry that owns the current route.
	 */
	public closeRailFlyout(): void {
		if (this._railFlyout?.isShown) {
			this._railFlyout.hide();
		}
	}

	/**
	 * Reveal the rail flyout without a pointer.
	 *
	 * The popover's own trigger is `hover`, which leaves a keyboard user with no way to see what a
	 * rail icon stands for; `show()` is independent of the trigger, so focusing the row opens the
	 * same panel the mouse gets. It is dismissed again on blur and on Escape.
	 */
	public showRailFlyout(): void {
		if (this._railFlyout && !this._railFlyout.isShown) {
			this._railFlyout.show();
		}
	}

	/**
	 * Open this entry's sub-menu from the collapsed rail via the keyboard.
	 *
	 * The flyout itself is a dead end for keyboard navigation — it lives in an overlay at the end of
	 * the document, so Tab never walks into it from the rail. Expanding the sidebar instead puts the
	 * child rows in the accordion body, right after this header in the DOM and in the tab order, so
	 * the routes are reachable. Nebular's own `keydown.enter`/`keydown.space` host listener opens the
	 * accordion item alongside this, which is what brings that body into view.
	 */
	public expandRailSubmenu(event?: Event): void {
		// Space would otherwise scroll the layout out from under the row that was just activated.
		event?.preventDefault();

		// The panel is anchored to a rail-width row that is about to grow; drop it rather than let it
		// hang over the expanded sidebar.
		this.closeRailFlyout();
		this._sidebarService.expand(MENU_SIDEBAR_TAG);
	}

	/**
	 * Track a click event using Jitsu analytics.
	 */
	public async jitsuTrackClick(): Promise<void> {
		// Prepare the click event data
		const clickEvent: JitsuAnalyticsEvents = {
			eventType: JitsuAnalyticsEventsEnum.BUTTON_CLICKED,
			url: this.item.url ?? this.item.link, // Use either item.url or item.link
			userId: this._user.id,
			userEmail: this._user.email,
			menuItemName: this.item.title
		};

		// Identify the user with Jitsu
		await this._jitsuService.identify(this._user.id, {
			email: this._user.email,
			fullName: this._user.name,
			timeZone: this._user.timeZone
		});

		// Group the user with Jitsu
		await this._jitsuService.group(this._user.id, {
			email: this._user.email,
			fullName: this._user.name,
			timeZone: this._user.timeZone
		});

		// Track the click event using Jitsu
		await this._jitsuService.trackEvents(clickEvent.eventType, clickEvent);
	}

	/**
	 * Redirect to a specified URL and track the click event using Jitsu analytics.
	 */
	public redirectTo(): void {
		// Track the click event using Jitsu analytics
		// We don't await here because we don't want to wait for the analytics to complete before redirecting
		this.jitsuTrackClick();

		// Redirect to the specified URL
		if (!this.item.children && this.item.link) {
			// If the item doesn't have children, navigate to its link
			this._router.navigateByUrl(this.item.link);
		}
		if (this.item.home && this.item.url) {
			// If the item represents the home page, navigate to its URL
			this._router.navigateByUrl(this.item.url);
		}

		// Emit the selectedChange event to notify parent components
		this.selectedChange.emit(this.item);

		// Manually detect changes using ChangeDetectorRef
		this._cdr.detectChanges();
	}

	/**
	 * Toggle the sidebar and perform a redirection if necessary.
	 */
	public toggleSidebar(): void {
		// Check if the sidebar is closed and the current item is not the home page
		if (!this.state && !this.item.home) {
			// If so, toggle the sidebar to open
			this._sidebarService.toggle(false, MENU_SIDEBAR_TAG);
		}

		// Perform redirection
		this.redirectTo();
	}

	/**
	 * Prepare an external URL.
	 * @param url The URL to prepare.
	 * @returns The prepared external URL.
	 */
	public getExternalUrl(url: string | undefined): string {
		if (!url) {
			return '';
		}
		try {
			return this._location.prepareExternalUrl(url);
		} catch (error) {
			console.warn('Error preparing external URL:', url, error);
			return '';
		}
	}

	/**
	 * Mirror of `*ngxPermissionsOnly` for a single item, evaluated synchronously.
	 *
	 * The directive authorizes when the list is empty and otherwise when ANY listed permission is
	 * held; permissions here are loaded plainly (`loadPermissions(permissions)` in pages.component),
	 * with no validation functions and no roles, so presence in the store is the whole test.
	 *
	 * @param item The menu item to test.
	 * @param permissions The permission store snapshot to test against.
	 * @return {boolean} True when the item would be rendered by `*ngxPermissionsOnly`.
	 */
	private isAuthorized(item: IMenuItem, permissions: NgxPermissionsObject): boolean {
		const permissionKeys = item?.data?.permissionKeys;
		if (!permissionKeys?.length) {
			return true;
		}
		return permissionKeys.some((key: string) => !!permissions[key]);
	}

	/**
	 * Read the sidebar's current expanded/collapsed state.
	 *
	 * `take(1)` is what makes this safe to call repeatedly: getSidebarState() hands back a
	 * ReplaySubject that receives exactly one value, so without it the subscription would sit open
	 * forever waiting for a second emission that never comes.
	 */
	private syncSidebarState(): void {
		this._sidebarService
			.getSidebarState(MENU_SIDEBAR_TAG)
			.pipe(
				take(1),
				tap((state) => {
					this.state = state === 'expanded';
					this._cdr.markForCheck();
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}
}
