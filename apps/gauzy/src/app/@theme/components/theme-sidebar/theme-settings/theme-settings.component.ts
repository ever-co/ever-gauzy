import { Component, OnInit, OnDestroy } from '@angular/core';
import {
	NbThemeService,
	NbLayoutDirectionService,
	NbLayoutDirection,
	DEFAULT_THEME,
	DARK_THEME,
	COSMIC_THEME,
	CORPORATE_THEME
} from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import {
	LanguagesEnum,
	IUser,
	ComponentLayoutStyleEnum
} from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Store, UsersService } from './../../../../@core/services';
import { filter } from 'rxjs/operators';

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

	languages = [];
	languagesEnum = {};

	currentTheme = DEFAULT_THEME.name;
	currentLang: string = LanguagesEnum.ENGLISH;
	currentLayout: string = ComponentLayoutStyleEnum.TABLE;

	currentUser: IUser;

	constructor(
		private readonly themeService: NbThemeService,
		private readonly translate: TranslateService,
		private readonly directionService: NbLayoutDirectionService,
		private readonly store: Store,
		private readonly userService: UsersService
	) { }

	async ngOnInit() {
		this.store.systemLanguages$
			.pipe(
				filter((systemLanguages) => !!systemLanguages),
				untilDestroyed(this)
			)
			.subscribe((systemLanguages) => {
				if (systemLanguages && systemLanguages.length > 0) {
					this.languages = systemLanguages
						.filter((item) => !!item.is_system)
						.map((item) => {
							return {
								value: item.code,
								name: 'SETTINGS_MENU.' + item.name.toUpperCase()
							};
						});
				}
			});

		this.store.user$.pipe(untilDestroyed(this)).subscribe((user) => {
			if (user) {
				this.currentUser = user;
				if (
					user.preferredLanguage &&
					user.preferredLanguage !== this.currentLang
				) {
					this.currentLang = this.currentUser.preferredLanguage;
				}
				this.switchLanguage();
				if (
					user.preferredComponentLayout &&
					user.preferredComponentLayout !== this.currentLayout
				) {
					this.currentLayout = user.preferredComponentLayout;
				}
				this.switchComponentLayout();
			}
		});

		this.store.preferredLanguage$
			.pipe(untilDestroyed(this))
			.subscribe((preferredLanguage) => {
				if (
					preferredLanguage &&
					preferredLanguage !== this.currentLang
				) {
					this.currentLang = preferredLanguage;
					this.switchLanguage();
				}
			});

		this.store.preferredComponentLayout$
			.pipe(untilDestroyed(this))
			.subscribe((preferredLayout) => {
				if (preferredLayout && preferredLayout !== this.currentLayout) {
					this.currentLayout = preferredLayout;
				}
			});
	}

	toggleTheme() {
		this.themeService.changeTheme(this.currentTheme);
	}

	switchLanguage() {

		if (this.currentLang === LanguagesEnum['HEBREW']) {
			this.directionService.setDirection(NbLayoutDirection.RTL);
		} else {
			this.directionService.setDirection(NbLayoutDirection.LTR);
		}

		this.store.preferredLanguage = this.currentLang;
		const updatedUserData = {
			preferredLanguage: this.store.preferredLanguage
		};
		this.updateUser(updatedUserData);
		if (
			this.currentLang !== this.translate.currentLang &&
			!!this.store.systemLanguages.find(
				(item) => item.code === this.currentLang
			)
		) {
			this.translate.use(this.currentLang);
		}
	}

	switchComponentLayout(selectedStyle?: ComponentLayoutStyleEnum) {
		this.store.preferredComponentLayout =
			selectedStyle || this.currentLayout;

		this.updateUser({
			preferredComponentLayout: selectedStyle || this.currentLayout
		});
	}

	resetLayoutForAllComponents() {
		this.store.componentLayout = [];
	}

	private async updateUser(updatedUserData: any) {
		try {
			await this.userService.update(this.currentUser.id, updatedUserData);
		} catch (error) { }
	}

	ngOnDestroy(): void { }
}
