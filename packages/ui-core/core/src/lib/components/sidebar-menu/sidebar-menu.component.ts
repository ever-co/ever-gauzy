import { CommonModule } from '@angular/common';
import {
	AfterContentChecked,
	AfterViewInit,
	ChangeDetectionStrategy,
	ChangeDetectorRef,
	Component,
	inject,
	Input,
	OnInit
} from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { MenuItemComponent } from './menu-items/concrete/menu-item/menu-item.component';
import { IMenuItem, IMenuItemFocusChangeEvent } from './menu-items/interface/menu-item.interface';
import { findActiveMenuItem, isSameMenuItem, isSameMenuMatch } from './menu-items/menu-item.utils';
import { SidebarMenuService } from '../../services/nav-builder/sidebar-menu.service';

@UntilDestroy()
@Component({
	selector: 'ga-sidebar-menu',
	templateUrl: './sidebar-menu.component.html',
	styleUrls: ['./sidebar-menu.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	standalone: true,
	imports: [CommonModule, MenuItemComponent]
})
export class SidebarMenuComponent implements OnInit, AfterContentChecked, AfterViewInit {
	private readonly _cdr = inject(ChangeDetectorRef);
	private readonly _router = inject(Router);
	private readonly _sidebarMenuService = inject(SidebarMenuService);

	private _items: IMenuItem[] = [];

	@Input()
	public set items(value: IMenuItem[]) {
		this._items = value;
		// Each emission of the menu config is a fresh tree (mapMenuSections rebuilds it), and the one
		// that lands first may predate the entry owning the URL — reports, custom dashboards and
		// plugin items all arrive later — so the active row is resolved again whenever it changes.
		this.syncWithUrl(this._router.url);
	}

	public get items(): IMenuItem[] {
		return this._items;
	}

	public get selectedItem() {
		return this._sidebarMenuService.selectedItem;
	}
	public set selectedItem(value: IMenuItem) {
		this._sidebarMenuService.selectedItem = value;
		this._cdr.detectChanges();
	}

	public get selectedChild(): IMenuItem | null {
		return this._sidebarMenuService.selectedChild;
	}

	ngOnInit(): void {
		this._router.events
			.pipe(
				filter((event): event is NavigationEnd => event instanceof NavigationEnd),
				untilDestroyed(this)
			)
			.subscribe((event) => this.syncWithUrl(event.urlAfterRedirects));
	}

	ngAfterContentChecked(): void {
		this._cdr.detectChanges();
	}

	ngAfterViewInit(): void {
		this._cdr.detectChanges();
	}

	public isSelected(item: IMenuItem): boolean {
		return isSameMenuItem(item, this.selectedItem);
	}

	/**
	 * Sets the selected item in the sidebar menu and triggers change detection.
	 *
	 * @param event The row that was picked, and the sub-row inside it when there is one.
	 */
	public focusOn(event: IMenuItemFocusChangeEvent): void {
		this.select(event.parent, event.children);

		// Trigger change detection
		this._cdr.detectChanges();
	}

	/**
	 * Highlight the row that owns a URL.
	 *
	 * When no row claims the URL — a detail page under a section whose link is matched exactly, or a
	 * page outside the menu altogether — the current highlight is left alone rather than cleared, so
	 * the section the user came from stays marked. That also keeps the main and settings menus, which
	 * share the selection through SidebarMenuService, from wiping out each other's match.
	 *
	 * @param url The router URL to resolve.
	 */
	private syncWithUrl(url: string): void {
		const current = { item: this.selectedItem, child: this.selectedChild };
		const match = findActiveMenuItem(this._items, url, current);
		if (match && !isSameMenuMatch(match, current)) {
			this.select(match.item, match.child);
		}
	}

	private select(item: IMenuItem, child: IMenuItem | null = null): void {
		this._sidebarMenuService.selectedItem = item;
		this._sidebarMenuService.selectedChild = child;
		this._cdr.markForCheck();
	}
}
