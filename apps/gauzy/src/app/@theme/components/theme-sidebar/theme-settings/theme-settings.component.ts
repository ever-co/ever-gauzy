import { Component, OnInit, OnDestroy } from '@angular/core';
import {
	NbThemeService,
	DEFAULT_THEME,
	DARK_THEME,
	COSMIC_THEME,
	CORPORATE_THEME,
	NbSidebarService
} from '@nebular/theme';
import { IUser, ComponentLayoutStyleEnum } from '@gauzy/contracts';
import { filter, tap, map } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Store, UsersService } from './../../../../@core/services';
import { MATERIAL_LIGHT_THEME } from '../../../styles/material/theme.material-light';
import { MATERIAL_DARK_THEME } from '../../../styles/material/theme.material-dark';
import { GAUZY_LIGHT } from '../../../styles/gauzy/theme.gauzy-light';
import { GAUZY_DARK } from '../../../styles/gauzy/theme.gauzy-dark';
import { BehaviorSubject } from 'rxjs';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-theme-settings',
	styleUrls: ['./theme-settings.component.scss'],
	templateUrl: './theme-settings.component.html'
})
export class ThemeSettingsComponent implements OnInit, OnDestroy {
	themes = [
		{ value: GAUZY_LIGHT.name, name: 'SETTINGS_MENU.GAUZY_LIGHT' },
		{ value: GAUZY_DARK.name, name: 'SETTINGS_MENU.GAUZY_DARK' },
		{ value: DEFAULT_THEME.name, name: 'SETTINGS_MENU.LIGHT' },
		{ value: DARK_THEME.name, name: 'SETTINGS_MENU.DARK' },
		{ value: COSMIC_THEME.name, name: 'SETTINGS_MENU.COSMIC' },
		{ value: CORPORATE_THEME.name, name: 'SETTINGS_MENU.CORPORATE' },
		{
			value: MATERIAL_LIGHT_THEME.name,
			name: 'SETTINGS_MENU.MATERIAL_LIGHT_THEME'
		},
		{
			value: MATERIAL_DARK_THEME.name,
			name: 'SETTINGS_MENU.MATERIAL_DARK_THEME'
		}
	];
	componentLayouts = Object.keys(ComponentLayoutStyleEnum);

	currentTheme = GAUZY_LIGHT.name;
	currentLayout: string = ComponentLayoutStyleEnum.TABLE;

	currentTheme$: BehaviorSubject<string> = new BehaviorSubject<string>(null);

	user: IUser;

	constructor(
		private readonly themeService: NbThemeService,
		private readonly store: Store,
		private readonly userService: UsersService,
		private readonly sidebarService: NbSidebarService
	) {}

	async ngOnInit() {
		this.store.user$
			.pipe(
				filter((user: IUser) => !!user),
				tap((user: IUser) => (this.user = user)),
				untilDestroyed(this)
			)
			.subscribe((user) => {
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
		this.themeService
			.onThemeChange()
			.pipe(
				map(({ name }) => name),
				untilDestroyed(this)
			)
			.subscribe((themeName) => (this.currentTheme = themeName));

		this.currentTheme$.subscribe((theme) => {
			theme = theme
				? theme
				: this.store.currentTheme
				? this.store.currentTheme
				: this.currentTheme;
			this.store.currentTheme = theme;
			this.themeService.changeTheme(theme);
		});
	}

	toggleTheme() {
		this.currentTheme$.next(this.currentTheme);
	}

	switchComponentLayout(selectedStyle?: ComponentLayoutStyleEnum) {
		this.store.preferredComponentLayout =
			selectedStyle || this.currentLayout;

		this.changePreferredComponentLayout({
			preferredComponentLayout: selectedStyle || this.currentLayout
		});
	}

	resetLayoutForAllComponents() {
		this.store.componentLayout = [];
	}

	private async changePreferredComponentLayout(request: any) {
		if (!this.user) {
			return;
		}
		try {
			await this.userService.updatePreferredComponentLayout(
				this.user.id,
				request
			);
		} catch (error) {
			console.error(`Failed to update user preferred component layout`);
		}
	}

	public closeSidebar() {
		this.sidebarService.toggle(false, 'settings_sidebar');
	}

	ngOnDestroy(): void {}
}
