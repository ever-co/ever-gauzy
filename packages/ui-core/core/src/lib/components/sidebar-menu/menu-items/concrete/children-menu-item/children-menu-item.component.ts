import { CommonModule, Location } from '@angular/common';
import { Component, inject, Input, output, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { NgxPermissionsModule } from 'ngx-permissions';
import { TranslatePipe } from '@ngx-translate/core';
import { IMenuItem, IMenuItemFocusChangeEvent } from '../../interface/menu-item.interface';
import { NbButtonModule, NbTooltipModule } from '@nebular/theme';
import { TooltipDirective } from '../../../../../directives/tooltip.directive';

@Component({
	selector: 'ga-children-menu-item',
	templateUrl: './children-menu-item.component.html',
	styleUrls: ['./children-menu-item.component.scss'],
	standalone: true,
	changeDetection: ChangeDetectionStrategy.Eager,
	imports: [CommonModule, NgxPermissionsModule, NbTooltipModule, NbButtonModule, TooltipDirective, TranslatePipe]
})
export class ChildrenMenuItemComponent {
	private readonly router = inject(Router);
	private readonly location = inject(Location);
	public readonly focusItemChange = output<IMenuItemFocusChangeEvent>();

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
	 * Suppresses the row's own tooltip. Set by the rail flyout, where the label is already fully
	 * visible and a tooltip repeating it would just stack a second overlay on top of the panel.
	 */
	@Input() tooltipDisabled = false;

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
}
