import { Component, OnInit, OnDestroy, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { debounceTime, filter, tap, from, concatMap } from 'rxjs';
import { ILanguage, IUser, IUserUpdateInput, LanguagesEnum } from '@gauzy/contracts';
import { LanguagesService, UsersService } from '@gauzy/ui-core/core';
import { Store } from '@gauzy/ui-core/common';
import { I18nService } from '@gauzy/ui-core/i18n';
import { ThemeLanguageSelectorService } from './theme-language-selector.service';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-theme-language-selector',
	styleUrls: ['./theme-language-selector.component.scss'],
	templateUrl: './theme-language-selector.component.html'
})
export class ThemeLanguageSelectorComponent implements OnInit, OnDestroy, AfterViewInit {
	user: IUser;
	languages: ILanguage[] = [];

	constructor(
		private readonly _store: Store,
		private readonly _userService: UsersService,
		private readonly _languagesService: LanguagesService,
		private readonly _cdr: ChangeDetectorRef,
		private readonly _selectorService: ThemeLanguageSelectorService,
		private readonly _i18nService: I18nService
	) {}

	ngOnInit(): void {
		this._store.systemLanguages$
			.pipe(
				filter((systemLanguages: ILanguage[]) => !!systemLanguages),
				tap((systemLanguages: ILanguage[]) => this.getSystemLanguages(systemLanguages)),
				untilDestroyed(this)
			)
			.subscribe();
		this._store.user$
			.pipe(
				debounceTime(100),
				filter((user: IUser) => !!user),
				tap((user: IUser) => (this.user = user)),
				tap(({ preferredLanguage }: IUser) => {
					if (!this._store.preferredLanguage) {
						this._store.preferredLanguage = preferredLanguage || this._i18nService.getBrowserLang();
					}
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit() {
		const systemLanguages = this._store.systemLanguages;
		if (!systemLanguages) {
			from(this._loadLanguages()).subscribe();
		}

		this._store.preferredLanguage$
			.pipe(
				debounceTime(100),
				filter((preferredLanguage: LanguagesEnum) => !!preferredLanguage),
				tap((preferredLanguage: LanguagesEnum) => (this.preferredLanguage = preferredLanguage)),
				tap(() => this._selectorService.setLanguage()),
				concatMap((preferredLanguage: LanguagesEnum) => this.changePreferredLanguage({ preferredLanguage })),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Load languages
	 */
	private async _loadLanguages() {
		const { items = [] } = await this._languagesService.getSystemLanguages();
		this._store.systemLanguages = items.filter((item: ILanguage) => item.is_system) || [];
		this._cdr.detectChanges();
	}

	/**
	 * Get system languages
	 *
	 * @param systemLanguages
	 */
	getSystemLanguages(systemLanguages: ILanguage[]) {
		if (systemLanguages && systemLanguages.length > 0) {
			this.languages = systemLanguages
				.filter((item) => !!item.is_system)
				.map((item) => {
					return {
						value: item.code,
						name: 'SETTINGS_MENU.' + item.name.toUpperCase()
					};
				});
		} else {
			const languages = [];
			for (const [name, code] of Object.entries(LanguagesEnum)) {
				languages.push({
					code,
					name,
					is_system: true
				});
			}
			this._store.systemLanguages = languages;
		}
	}

	/**
	 * Switch language
	 */
	switchLanguage() {
		this._store.preferredLanguage = this.preferredLanguage;
	}

	/**
	 * Changed User Selected Preferred Language
	 *
	 * @param payload
	 * @returns
	 */
	private async changePreferredLanguage(payload: IUserUpdateInput) {
		if (!this.user || !this.user.tenantId) {
			return;
		}

		try {
			await this._userService.updatePreferredLanguage(payload);
		} catch (error) {
			console.error(`Failed to update user preferred language`);
		}
	}

	/**
	 * Get preferred language
	 */
	public get preferredLanguage(): LanguagesEnum {
		return this._selectorService.preferredLanguage;
	}

	/**
	 * Set preferred language
	 */
	public set preferredLanguage(value: LanguagesEnum) {
		this._selectorService.preferredLanguage = value;
	}

	ngOnDestroy(): void {}
}
