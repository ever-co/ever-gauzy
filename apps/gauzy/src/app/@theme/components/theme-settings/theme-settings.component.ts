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
import { LanguagesEnum } from '@gauzy/models';

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

	languages = [
		{
			value: LanguagesEnum.ENGLISH,
			name: 'SETTINGS_MENU.ENGLISH'
		},
		{
			value: LanguagesEnum.BULGARIAN,
			name: 'SETTINGS_MENU.BULGARIAN'
		},
		{
			value: LanguagesEnum.HEBREW,
			name: 'SETTINGS_MENU.HEBREW'
		},
		{
			value: LanguagesEnum.RUSSIAN,
			name: 'SETTINGS_MENU.RUSSIAN'
		}
	];

	currentTheme = 'default';
	currentLang = LanguagesEnum.ENGLISH;

	supportedLanguages = Object.values(LanguagesEnum);

	private _ngDestroy$ = new Subject<void>();

	constructor(
		private themeService: NbThemeService,
		private translate: TranslateService,
		private directionService: NbLayoutDirectionService,
		private store: Store
	) {
		translate.addLangs(this.supportedLanguages);
		translate.setDefaultLang(LanguagesEnum.ENGLISH);

		const browserLang = translate.getBrowserLang() as LanguagesEnum;
		this.currentLang =
			this.store.preferredLanguage ||
			this.supportedLanguages.includes(browserLang)
				? browserLang
				: (translate.defaultLang as LanguagesEnum);
		this.translate.use(this.currentLang);
	}

	ngOnInit() {
		this.store.user$.pipe(takeUntil(this._ngDestroy$)).subscribe((user) => {
			if (
				user &&
				user.preferredLanguage &&
				user.preferredLanguage !== this.currentLang
			) {
				this.currentLang = user.preferredLanguage as LanguagesEnum;
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

	toggleTheme() {
		this.themeService.changeTheme(this.currentTheme);
	}

	switchLanguage() {
		if (this.currentLang === LanguagesEnum.HEBREW) {
			this.directionService.setDirection(NbLayoutDirection.RTL);
		} else {
			this.directionService.setDirection(NbLayoutDirection.LTR);
		}

		this.store.preferredLanguage = this.currentLang;
		this.translate.use(
			this.supportedLanguages.includes(this.currentLang)
				? this.currentLang
				: this.translate.defaultLang
		);
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
