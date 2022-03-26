import { Component, OnInit } from '@angular/core';
import { GAUZY_LIGHT } from '../../../../../styles/gauzy/theme.gauzy-light';
import { GAUZY_DARK } from '../../../../../styles/gauzy/theme.gauzy-dark';
import { CORPORATE_THEME } from '../../../../../styles/theme.corporate';
import { DEFAULT_THEME } from '../../../../../styles/theme.default';
import { DARK_THEME } from '../../../../../styles/theme.dark';
import { COSMIC_THEME } from '../../../../../styles/theme.cosmic';
import { MATERIAL_LIGHT_THEME } from '../../../../../styles/material/theme.material-light';
import { MATERIAL_DARK_THEME } from '../../../../../styles/material/theme.material-dark';
import { BehaviorSubject, map, Observable } from 'rxjs';
import { Store } from 'apps/gauzy/src/app/@core';
import { NbThemeService } from '@nebular/theme';
import { untilDestroyed, UntilDestroy } from '@ngneat/until-destroy';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'gauzy-theme-selector',
	templateUrl: './theme-selector.component.html',
	styleUrls: ['./theme-selector.component.scss']
})
export class ThemeSelectorComponent implements OnInit {
	_themes = [
		{
			light: {
				value: GAUZY_LIGHT.name,
				name: 'SETTINGS_MENU.GAUZY_LIGHT'
			},
			dark: { value: GAUZY_DARK.name, name: 'SETTINGS_MENU.GAUZY_DARK' }
		},
		{
			light: { value: DEFAULT_THEME.name, name: 'SETTINGS_MENU.LIGHT' },
			dark: { value: DARK_THEME.name, name: 'SETTINGS_MENU.DARK' }
		},
		{
			light: {
				value: CORPORATE_THEME.name,
				name: 'SETTINGS_MENU.CORPORATE'
			},
			dark: { value: COSMIC_THEME.name, name: 'SETTINGS_MENU.COSMIC' }
		},
		{
			light: {
				value: MATERIAL_LIGHT_THEME.name,
				name: 'SETTINGS_MENU.MATERIAL_LIGHT_THEME'
			},
			dark: {
				value: MATERIAL_DARK_THEME.name,
				name: 'SETTINGS_MENU.MATERIAL_DARK_THEME'
			}
		}
	];

	switch: Observable<boolean> = new Observable<boolean>();
	switch$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);

	currentTheme = GAUZY_LIGHT.name;

	currentTheme$: BehaviorSubject<string> = new BehaviorSubject<string>(null);

	constructor(
		protected readonly themeService: NbThemeService,
		protected readonly store: Store
	) {}

	ngOnInit(): void {
		this.themeService
			.onThemeChange()
			.pipe(
				map(({ name }) => name),
				untilDestroyed(this)
			)
			.subscribe((themeName) => {
				this.currentTheme = themeName;
				this.updateSwitch();
			});

		this.currentTheme$.subscribe((theme) => {
			theme = theme
				? theme
				: this.store.currentTheme
				? this.store.currentTheme
				: this.currentTheme;
			this.store.currentTheme = theme;
			this.themeService.changeTheme(theme);
		});
		this.switch$.subscribe();
		this.switch = this.switch$.asObservable();
	}

	toggleTheme() {
		this.currentTheme$.next(this.currentTheme);
	}

	get themes(): string[] {
		const themes = [];
		this._themes.map((theme) => {
			themes.push(theme.light);
			themes.push(theme.dark);
		});
		return themes;
	}

	updateSwitch() {
		this.switch$.next(this.isDark.state);
	}

	reverseTheme() {
		this.currentTheme = this.isDark.reverse;
		this.toggleTheme();
	}

	get isDark() {
		const res = {
			reverse: this.currentTheme,
			state: false
		};
		this._themes.forEach((theme) => {
			if (theme.light.value === this.currentTheme) {
				res.reverse = theme.dark.value;
				res.state = false;
			} else if (theme.dark.value === this.currentTheme) {
				res.reverse = theme.light.value;
				res.state = true;
			}
		});
		return res;
	}

	ngOnDestroy(): void {}
}
