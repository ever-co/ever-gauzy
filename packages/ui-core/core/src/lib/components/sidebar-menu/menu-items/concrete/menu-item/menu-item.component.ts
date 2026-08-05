import { ChangeDetectorRef, Component, EventEmitter, inject, Input, OnInit, Output } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router } from '@angular/router';
import { NbAccordionModule, NbSidebarService, NbTooltipModule } from '@nebular/theme';
import { merge } from 'rxjs';
import { filter, take, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { NgxPermissionsModule } from 'ngx-permissions';
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

	@Output() public collapsedChange: EventEmitter<any> = new EventEmitter();
	@Output() public selectedChange: EventEmitter<any> = new EventEmitter();

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
		// Re-query only when the sidebar ACTUALLY changes. Every path that changes it goes through the
		// service (the layout's toggle()/expand(), and this component's own toggle below), and this
		// sidebar is not `responsive`, so it never changes state on its own. Ordering is safe:
		// NbSidebarComponent hosts these items, so its own subscription is registered first and has
		// already applied the change by the time we re-read it.
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
