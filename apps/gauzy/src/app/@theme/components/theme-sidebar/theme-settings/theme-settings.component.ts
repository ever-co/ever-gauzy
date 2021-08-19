import { Component, OnInit, OnDestroy } from '@angular/core';
import {
	NbThemeService,
	DEFAULT_THEME,
	DARK_THEME,
	COSMIC_THEME,
	CORPORATE_THEME
} from '@nebular/theme';
import {
	IUser,
	ComponentLayoutStyleEnum
} from '@gauzy/contracts';
import { filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Store, UsersService } from './../../../../@core/services';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-theme-settings',
	styleUrls: ['./theme-settings.component.scss'],
	templateUrl: './theme-settings.component.html'
})
export class ThemeSettingsComponent implements OnInit, OnDestroy {
	themes = [
		{ value: DEFAULT_THEME.name, name: 'SETTINGS_MENU.LIGHT' },
		{ value: DARK_THEME.name, name: 'SETTINGS_MENU.DARK' },
		{ value: COSMIC_THEME.name, name: 'SETTINGS_MENU.COSMIC' },
		{ value: CORPORATE_THEME.name, name: 'SETTINGS_MENU.CORPORATE' }
	];
	componentLayouts = Object.keys(ComponentLayoutStyleEnum);

	currentTheme = DEFAULT_THEME.name;
	currentLayout: string = ComponentLayoutStyleEnum.TABLE;

	user: IUser;

	constructor(
		private readonly themeService: NbThemeService,
		private readonly store: Store,
		private readonly userService: UsersService
	) { }

	async ngOnInit() {
		this.store.user$
			.pipe(
				filter((user: IUser) => !!user),
				tap((user: IUser) => this.user = user),
				untilDestroyed(this)
			).subscribe((user) => {
				if (user) {
					if (
						user.preferredComponentLayout &&
						user.preferredComponentLayout !== this.currentLayout
					) {
						this.currentLayout = user.preferredComponentLayout;
					}
					this.switchComponentLayout();
				}
			});
		this.store.preferredComponentLayout$
			.pipe(
				filter((preferredLayout: string) => !!preferredLayout),
				untilDestroyed(this)
			)
			.subscribe((preferredLayout) => {
				if (preferredLayout && preferredLayout !== this.currentLayout) {
					this.currentLayout = preferredLayout;
				}
			});
	}

	toggleTheme() {
		this.themeService.changeTheme(this.currentTheme);
	}

	switchComponentLayout(selectedStyle?: ComponentLayoutStyleEnum) {
		this.store.preferredComponentLayout = selectedStyle || this.currentLayout;

		this.changePreferredComponentLayout({
			preferredComponentLayout: selectedStyle || this.currentLayout
		});
	}

	resetLayoutForAllComponents() {
		this.store.componentLayout = [];
	}

	private async changePreferredComponentLayout(data: any) {
		if (!this.user) {
			return;
		}
		try {
			await this.userService.update(this.user.id, data);
		} catch (error) { 
			throw new Error(`Failed to update user preferred component layout: ${error}`);
		}
	}

	ngOnDestroy(): void { }
}
