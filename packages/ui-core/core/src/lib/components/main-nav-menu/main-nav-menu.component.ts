import { Component, Input, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { NavMenuCategory, NavMenuSectionItem } from '../../services/nav-builder/nav-builder-types';
import { BaseNavMenuComponent } from '../base-nav-menu/base-nav-menu.component';

@Component({
	selector: 'ga-main-nav-menu',
	templateUrl: './main-nav-menu.component.html',
	styleUrls: ['./main-nav-menu.component.scss']
})
export class MainNavMenuComponent extends BaseNavMenuComponent implements OnInit {
	// Define the input property menuCategory of type NavMenuCategory | undefined
	@Input() menuCategory: NavMenuCategory | undefined;

	// Define the observable property menuConfig$ of type Observable<NavMenuSection[]>
	public mainMenuConfig$: Observable<NavMenuSectionItem[]>;

	override ngOnInit(): void {
		super.ngOnInit(); // Call the parent class's ngOnInit function

		// Subscribe to the menuConfig$ observable provided by _navMenuBuilderService
		this.mainMenuConfig$ = this._navMenuBuilderService.menuConfig$.pipe(
			map((sections: NavMenuSectionItem[]) =>
				this.mapMenuSections(sections).filter((section) =>
					this.menuCategory ? section.menuCategory === this.menuCategory : !section.menuCategory
				)
			)
		);
	}
}
