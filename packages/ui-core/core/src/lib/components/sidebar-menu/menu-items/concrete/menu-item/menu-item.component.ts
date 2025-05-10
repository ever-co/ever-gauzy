import { AfterViewChecked, ChangeDetectorRef, Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import { tap } from 'rxjs/operators';
import { NbSidebarService } from '@nebular/theme';
import { IUser } from '@gauzy/contracts';
import { JitsuAnalyticsEvents, JitsuAnalyticsEventsEnum, JitsuService, Store } from '../../../../../services';
import { IMenuItem } from '../../interface/menu-item.interface';

@Component({
    selector: 'ga-menu-item',
    templateUrl: './menu-item.component.html',
    styleUrls: ['./menu-item.component.scss'],
    standalone: false
})
export class MenuItemComponent implements OnInit, AfterViewChecked {
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

	constructor(
		private readonly _router: Router,
		private readonly _sidebarService: NbSidebarService,
		private readonly _cdr: ChangeDetectorRef,
		private readonly _location: Location,
		private readonly _jitsuService: JitsuService,
		private readonly _store: Store
	) {}

	ngOnInit(): void {
		// Get the user data from the store
		this._user = this._store.user;

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
	public focusOn(event: any): void {
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
		if (!this.item.children) {
			// If the item doesn't have children, navigate to its link
			this._router.navigateByUrl(this.item.link);
		}
		if (this.item.home) {
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
			this._sidebarService.toggle(false, 'menu-sidebar');
		}

		// Perform redirection
		this.redirectTo();
	}

	/**
	 * Prepare an external URL.
	 * @param url The URL to prepare.
	 * @returns The prepared external URL.
	 */
	public getExternalUrl(url: string): string {
		return url ? this._location.prepareExternalUrl(url) : url;
	}

	/**
	 *
	 */
	ngAfterViewChecked(): void {
		const state$ = this._sidebarService.getSidebarState('menu-sidebar');
		state$.pipe(tap((state) => (this.state = state === 'expanded' ? true : false))).subscribe();
		this._cdr.detectChanges();
	}
}
