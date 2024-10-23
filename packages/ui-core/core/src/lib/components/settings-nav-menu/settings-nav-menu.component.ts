import { Component, OnInit } from '@angular/core';
import { Observable, map } from 'rxjs';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { BaseNavMenuComponent } from '../base-nav-menu/base-nav-menu.component';
import { NavMenuSectionItem } from '../../services/nav-builder/nav-builder-types';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-settings-nav-menu',
	templateUrl: './settings-nav-menu.component.html',
	styleUrls: ['./settings-nav-menu.component.scss']
})
export class SettingsNavMenuComponent extends BaseNavMenuComponent implements OnInit {
	public settingsMenuConfig$: Observable<NavMenuSectionItem[]>;

	override ngOnInit(): void {
		super.ngOnInit(); // Call the parent class's ngOnInit function

		// Subscribe to the menuConfig$ observable provided by _navMenuBuilderService
		this.settingsMenuConfig$ = this._navMenuBuilderService.menuConfig$.pipe(
			map((sections: NavMenuSectionItem[]) =>
				this.mapMenuSections(sections ?? []).filter((section) => section.menuCategory === 'settings')
			),
			untilDestroyed(this)
		);
	}

	override ngOnDestroy(): void {
		super.ngOnDestroy();
	}
}
