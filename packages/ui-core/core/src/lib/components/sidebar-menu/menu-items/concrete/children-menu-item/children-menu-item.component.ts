import { Location } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { IMenuItem } from '../../interface/menu-item.interface';

@UntilDestroy()
@Component({
	selector: 'ga-children-menu-item',
	templateUrl: './children-menu-item.component.html',
	styleUrls: ['./children-menu-item.component.scss']
})
export class ChildrenMenuItemComponent implements OnInit {
	/**
	 * Represents a menu item component.
	 */
	private _item: IMenuItem;
	get item(): IMenuItem {
		return this._item;
	}
	@Input() set item(value: IMenuItem) {
		this._item = value;
	}

	/**
	 * Represents the parent menu item of the current item.
	 */
	private _parent: IMenuItem;
	get parent(): IMenuItem {
		return this._parent;
	}
	@Input() set parent(value: IMenuItem) {
		this._parent = value;
	}

	/**
	 * Indicates whether the menu item is collapsed.
	 */
	private _collapse: boolean;
	get collapse() {
		return this._collapse;
	}
	@Input() set collapse(value: boolean) {
		this._collapse = value;
	}

	/**
	 * Indicates whether the menu item is selected.
	 */
	private _selected = false;
	get selected(): boolean {
		return this._selected;
	}
	@Input() set selected(value: boolean) {
		this._selected = value;
	}

	/**
	 * Indicates whether the mouse is hovering over the menu item.
	 */
	private _mouseHover: boolean;
	set mouseHover(value: boolean) {
		this._mouseHover = value;
	}
	get mouseHover() {
		return this._mouseHover;
	}

	@Output() public focusItemChange: EventEmitter<any> = new EventEmitter();

	constructor(private readonly router: Router, private readonly location: Location) {}

	ngOnInit(): void {
		// Log and check the current URL
		this.checkUrl(this.router.url);

		// Subscribe to router events and handle NavigationEnd
		this.router.events
			.pipe(
				filter((event) => event instanceof NavigationEnd),
				untilDestroyed(this)
			)
			.subscribe((event: NavigationEnd) => {
				// Log and check the URL when navigation ends
				this.checkUrl(event.url);
			});
	}

	/**
	 * Redirects to the specified URL link.
	 */
	public redirectTo(): void {
		this.router.navigateByUrl(this.item.link);
	}

	/**
	 * Selects the item and emits an event to focus on it.
	 * Additionally, redirects to the specified link.
	 */
	public select(): void {
		// Emit an event to focus on the item
		this.focusItemChange.emit({
			children: this.item,
			parent: this.parent
		});

		// Redirect to the specified link
		this.redirectTo();
	}

	/**
	 * Handles Ctrl + mouse click event to open a link in a new window/tab.
	 *
	 * @param event The MouseEvent object representing the mouse click event.
	 */
	public handleCtrlClick(event: MouseEvent): void {
		// Check if Ctrl or Cmd key is pressed
		if (event.ctrlKey || event.metaKey) {
			// Open the link in a new window/tab
			window.open(this.getExternalUrl(this.item.link), '_blank');
			// Prevent default behavior of anchor tag
			event.preventDefault();
		}
	}

	/**
	 * Checks if the provided URL matches the link of the current item,
	 * and emits an event to focus on the item if there is a match.
	 * @param url The URL to check against the item's link.
	 */
	public checkUrl(url: string): void {
		// Extract only the path part of the URL
		const pathOnly = url.split('?')[0];

		// Check if the path part of the URL matches the item's link
		if (pathOnly === this.item.link) {
			// Emit an event to focus on the item
			this.focusItemChange.emit({ children: this.item, parent: this.parent });
		}
	}

	/**
	 * Prepares the URL for external navigation.
	 * If the URL is not null or empty, it prepares it for external navigation using Angular's Location service.
	 * @param url The URL to prepare for external navigation.
	 * @returns The prepared URL for external navigation.
	 */
	public getExternalUrl(url: string): string {
		return url ? this.location.prepareExternalUrl(url) : url;
	}

	/**
	 * Emits an event to focus on the current item and navigates to the specified URL for adding.
	 */
	public add(): void {
		this.focusItemChange.emit({ children: this.item, parent: this.parent });
		this.router.navigateByUrl(this.item.data.add);
	}

	/**
	 * Checks if the current item is the last item among its siblings.
	 * @returns A boolean indicating whether the current item is the last among its siblings.
	 */
	public isLast(): boolean {
		const last = this.parent.children.slice(-1)[0];
		return this.item === last;
	}
}
