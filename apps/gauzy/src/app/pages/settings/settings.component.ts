import { Component, OnDestroy, OnInit } from '@angular/core';
import { Observable, map } from 'rxjs';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { BaseNavMenuComponent, NavMenuSectionItem } from '@gauzy/ui-core/core';

@UntilDestroy()
@Component({
	selector: 'ngx-settings',
	templateUrl: './settings.component.html',
	styleUrls: ['./settings.component.scss'],
	standalone: false
})
export class SettingsComponent extends BaseNavMenuComponent implements OnInit, OnDestroy {
	/** Visible settings menu entries rendered in the left column of the settings shell. */
	public settingsMenuItems$: Observable<NavMenuSectionItem[]>;

	override ngOnInit(): void {
		super.ngOnInit(); // Call the parent class's ngOnInit function

		// Build the settings menu list from the shared nav menu configuration, so items
		// registered dynamically (e.g. "AI Providers" added by plugins) are included too.
		this.settingsMenuItems$ = this._navMenuBuilderService.menuConfig$.pipe(
			map((sections: NavMenuSectionItem[]) =>
				this.mapMenuSections(
					(sections ?? []).filter((section: NavMenuSectionItem) => section.menuCategory === 'settings')
				)
					.flatMap((section: NavMenuSectionItem) => (section.children ?? []) as NavMenuSectionItem[])
					.filter((item: NavMenuSectionItem) => !item.hidden)
			),
			untilDestroyed(this)
		);
	}

	override ngOnDestroy(): void {
		super.ngOnDestroy();
	}
}
