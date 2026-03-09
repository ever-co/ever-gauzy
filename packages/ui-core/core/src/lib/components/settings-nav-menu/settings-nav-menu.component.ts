import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Observable, map } from 'rxjs';
import { BaseNavMenuComponent } from '../base-nav-menu/base-nav-menu.component';
import { SidebarMenuComponent } from '../sidebar-menu/sidebar-menu.component';
import { NavMenuSectionItem } from '../../services/nav-builder/nav-builder-types';

@UntilDestroy()
@Component({
	selector: 'ga-settings-nav-menu',
	templateUrl: './settings-nav-menu.component.html',
	styleUrls: ['./settings-nav-menu.component.scss'],
	standalone: true,
	imports: [CommonModule, SidebarMenuComponent]
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
