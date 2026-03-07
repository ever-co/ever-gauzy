import { Component, Input, OnInit } from '@angular/core';
import { Observable, catchError, map } from 'rxjs';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { BaseNavMenuComponent } from '../base-nav-menu/base-nav-menu.component';
import { NavMenuCategory, NavMenuSectionItem } from '../../services/nav-builder/nav-builder-types';

@UntilDestroy({ checkProperties: true })
@Component({
    selector: 'ga-main-nav-menu',
    templateUrl: './main-nav-menu.component.html',
    styleUrls: ['./main-nav-menu.component.scss'],
    standalone: false
})
export class MainNavMenuComponent extends BaseNavMenuComponent implements OnInit {
	// Define the input property menuCategory of type NavMenuCategory | undefined
	@Input() menuCategory: NavMenuCategory | undefined;

	// Define the observable property mainMenuConfig$ of type Observable<NavMenuSectionItem[]>
	public mainMenuConfig$: Observable<NavMenuSectionItem[]>;

	override ngOnInit(): void {
		super.ngOnInit(); // Call the parent class's ngOnInit function

		// Subscribe to the menuConfig$ observable provided by _navMenuBuilderService
		this.mainMenuConfig$ = this._navMenuBuilderService.menuConfig$.pipe(
			map((sections: NavMenuSectionItem[]) => this.filterSectionsByCategory(sections)),
			catchError((error) => {
				console.error('Error while retrieving main menu sections:', error);
				return [];
			}),
			untilDestroyed(this)
		);
	}

	/**
	 * Filters the provided menu sections based on the specified menu category.
	 *
	 * @param sections - An array of navigation menu section items to filter.
	 * @returns An array of navigation menu section items that match the specified menu category.
	 */
	private filterSectionsByCategory(sections: NavMenuSectionItem[]): NavMenuSectionItem[] {
		return this.mapMenuSections(sections ?? []).filter((section) =>
			this.menuCategory ? section?.menuCategory === this.menuCategory : !section?.menuCategory
		);
	}

	override ngOnDestroy(): void {
		super.ngOnDestroy();
	}
}
