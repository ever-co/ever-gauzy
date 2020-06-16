import { Component, OnInit, OnDestroy } from '@angular/core';
import {
	NbThemeService,
	NbLayoutDirectionService,
	NbLayoutDirection
} from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { Store } from '../../../@core/services/store.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { LanguagesEnum, User } from '@gauzy/models';
import { LanguagesService } from '../../../@core/services/languages.service';
import { UsersService } from '../../../@core/services';

@Component({
	selector: 'ngx-theme-settings',
	styleUrls: ['./theme-settings.component.scss'],
	templateUrl: './theme-settings.component.html'
})
export class ThemeSettingsComponent implements OnInit, OnDestroy {
	themes = [
		{
			value: 'default',
			name: 'SETTINGS_MENU.LIGHT'
		},
		{
			value: 'dark',
			name: 'SETTINGS_MENU.DARK'
		},
		{
			value: 'cosmic',
			name: 'SETTINGS_MENU.COSMIC'
		},
		{
			value: 'corporate',
			name: 'SETTINGS_MENU.CORPORATE'
		}
	];

	languages = [];
	languagesEnum = {};

	currentTheme = 'default';
	currentLang: string = LanguagesEnum.ENGLISH;

	supportedLanguages = [];
	currentUser: User;

	private _ngDestroy$ = new Subject<void>();

	constructor(
		private themeService: NbThemeService,
		private translate: TranslateService,
		private directionService: NbLayoutDirectionService,
		private store: Store,
		private readonly languagesService: LanguagesService,
		private readonly userService: UsersService
	) {
		translate.addLangs(this.supportedLanguages);
		translate.setDefaultLang(this.currentLang);

		const browserLang = translate.getBrowserLang() as string;
		this.currentLang =
			this.store.preferredLanguage ||
			this.supportedLanguages.includes(browserLang)
				? browserLang
				: (translate.defaultLang as string);
		this.translate.use(this.currentLang);
	}

	async ngOnInit() {
		await this.loadLanguages();
		this.store.user$.pipe(takeUntil(this._ngDestroy$)).subscribe((user) => {
			if (user) {
				this.currentUser = user;
				if (
					user.preferredLanguage &&
					user.preferredLanguage !== this.currentLang
				) {
					this.currentLang = this.currentUser.preferredLanguage;
				}
				this.switchLanguage();
			}
		});
		this.store.preferredLanguage$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((preferredLanguage) => {
				if (
					preferredLanguage &&
					preferredLanguage !== this.currentLang
				) {
					this.currentLang = preferredLanguage;
					this.switchLanguage();
				}
			});
	}

	private async loadLanguages() {
		const res = await this.languagesService.getSystemLanguages();
		this.supportedLanguages = res.items.map((item) => item.code);
		this.languages = res.items.map((item) => {
			return {
				value: item.code,
				name: 'SETTINGS_MENU.' + item.name.toUpperCase()
			};
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
		this.updateUserLanguage(updatedUserData);

		if (this.supportedLanguages.length) {
			this.translate.use(
				this.supportedLanguages.includes(this.currentLang)
					? this.currentLang
					: this.translate.defaultLang
			);
		}
	}

	private async updateUserLanguage(updatedUserData: any) {
		try {
			await this.userService.update(this.currentUser.id, updatedUserData);
		} catch (error) {}
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
