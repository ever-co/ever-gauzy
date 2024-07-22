import { Component, Input, OnInit } from '@angular/core';
import { BehaviorSubject, map, Observable } from 'rxjs';
import { NbThemeService } from '@nebular/theme';
import { untilDestroyed, UntilDestroy } from '@ngneat/until-destroy';
import { Store } from '@gauzy/ui-core/common';
import {
	CORPORATE_THEME,
	COSMIC_THEME,
	DARK_THEME,
	DEFAULT_THEME,
	GAUZY_DARK,
	GAUZY_LIGHT,
	MATERIAL_DARK_THEME,
	MATERIAL_LIGHT_THEME
} from '../../../../../themes';

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
				name: 'SETTINGS_MENU.GAUZY_LIGHT',
				imageUrl: 'assets/images/themes/gauzy_light.png'
			},
			dark: {
				value: GAUZY_DARK.name,
				name: 'SETTINGS_MENU.GAUZY_DARK',
				imageUrl: 'assets/images/themes/gauzy_dark.png'
			}
		},
		{
			light: {
				value: DEFAULT_THEME.name,
				name: 'SETTINGS_MENU.LIGHT',
				imageUrl: 'assets/images/themes/light.png'
			},
			dark: {
				value: DARK_THEME.name,
				name: 'SETTINGS_MENU.DARK',
				imageUrl: 'assets/images/themes/dark.png'
			}
		},
		{
			light: {
				value: CORPORATE_THEME.name,
				name: 'SETTINGS_MENU.CORPORATE',
				imageUrl: 'assets/images/themes/corporate.png'
			},
			dark: {
				value: COSMIC_THEME.name,
				name: 'SETTINGS_MENU.COSMIC',
				imageUrl: 'assets/images/themes/cosmic.png'
			}
		},
		{
			light: {
				value: MATERIAL_LIGHT_THEME.name,
				name: 'SETTINGS_MENU.MATERIAL_LIGHT_THEME',
				imageUrl: 'assets/images/themes/material_light.png'
			},
			dark: {
				value: MATERIAL_DARK_THEME.name,
				name: 'SETTINGS_MENU.MATERIAL_DARK_THEME',
				imageUrl: 'assets/images/themes/material_dark.png'
			}
		}
	];

	switch: Observable<boolean> = new Observable<boolean>();
	switch$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);

	currentTheme = GAUZY_LIGHT.name;

	currentTheme$: BehaviorSubject<string> = new BehaviorSubject<string>(null);

	selected: Observable<any> = new Observable<any>();
	selected$: BehaviorSubject<any> = new BehaviorSubject<any>(null);

	@Input()
	isClassic: boolean = true;

	constructor(protected readonly themeService: NbThemeService, protected readonly store: Store) {}

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
				this.updateCard();
			});

		this.currentTheme$.subscribe((theme) => {
			theme = theme ? theme : this.store.currentTheme ? this.store.currentTheme : this.currentTheme;
			this.store.currentTheme = theme;
			this.themeService.changeTheme(theme);
		});
		this.switch$.subscribe();
		this.selected$.subscribe();
		this.switch = this.switch$.asObservable();
		this.selected = this.selected$.asObservable();
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

	updateCard() {
		this.selected$.next(this.isDark.previous);
	}

	onSelectedTheme(theme: any) {
		this.currentTheme = theme;
		this.toggleTheme();
	}

	reverseTheme() {
		this.currentTheme = this.isDark.reverse;
		this.toggleTheme();
	}

	/**
	 * Checks if the current theme is dark or light and provides information about the opposite theme.
	 * @returns An object containing information about the current theme state and its opposite.
	 */
	get isDark() {
		const res = {
			previous: null,
			reverse: this.currentTheme,
			state: false
		};
		this._themes.forEach((theme) => {
			if (theme.light.value === this.currentTheme) {
				res.reverse = theme.dark.value;
				res.state = false;
				res.previous = theme.light;
			} else if (theme.dark.value === this.currentTheme) {
				res.reverse = theme.light.value;
				res.state = true;
				res.previous = theme.dark;
			}
		});
		return res;
	}

	ngOnDestroy(): void {}
}
