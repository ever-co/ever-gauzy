import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { NavMenuSectionItem } from '../../services/nav-builder/nav-builder-types';
import { BaseNavMenuComponent } from '../base-nav-menu/base-nav-menu.component';

@Component({
	selector: 'ga-main-nav-menu',
	templateUrl: './main-nav-menu.component.html',
	styleUrls: ['./main-nav-menu.component.scss']
})
export class MainNavMenuComponent extends BaseNavMenuComponent implements OnInit {
	public mainMenuConfig$: Observable<NavMenuSectionItem[]>;

	override ngOnInit(): void {
		super.ngOnInit(); // Call the parent class's ngOnInit function

		// Subscribe to the menuConfig$ observable provided by _navMenuBuilderService
		this.mainMenuConfig$ = this._navMenuBuilderService.menuConfig$.pipe(
			map((sections: NavMenuSectionItem[]) => this.mapMenuSections(sections))
		);
	}
}
