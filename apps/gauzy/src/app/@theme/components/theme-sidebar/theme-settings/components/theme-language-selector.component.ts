import { Component, OnInit, OnDestroy, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { ILanguage, IUser, IUserUpdateInput, LanguagesEnum } from '@gauzy/contracts';
import { debounceTime, filter, tap, from, concatMap } from 'rxjs';
import { LanguagesService, Store, UsersService } from './../../../../../@core/services';
import { ThemeLanguageSelectorService } from './theme-language-selector.service';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-theme-language-selector',
	styleUrls: ['./theme-language-selector.component.scss'],
	templateUrl: './theme-language-selector.component.html',
})
export class ThemeLanguageSelectorComponent implements OnInit, OnDestroy, AfterViewInit {

	user: IUser;
	languages: ILanguage[] = [];

	constructor(
		private readonly _store: Store,
		private readonly _userService: UsersService,
		private readonly _languagesService: LanguagesService,
		private readonly cdr: ChangeDetectorRef,
		private readonly _selectorService: ThemeLanguageSelectorService
	) { }

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
						this._store.preferredLanguage = preferredLanguage || LanguagesEnum.ENGLISH;
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
		};
		this._store.preferredLanguage$
			.pipe(
				debounceTime(100),
				filter(
					(preferredLanguage: LanguagesEnum) => !!preferredLanguage
				),
				tap(
					(preferredLanguage: LanguagesEnum) =>
						(this.preferredLanguage = preferredLanguage)
				),
				tap(() => this._selectorService.setLanguage()),
				concatMap((preferredLanguage: LanguagesEnum) =>
					this.changePreferredLanguage({
						preferredLanguage,
					})
				),
				untilDestroyed(this)
			)
			.subscribe();
	}

	private async _loadLanguages() {
		const { items = [] } = await this._languagesService.getSystemLanguages();
		this._store.systemLanguages = items.filter((item: ILanguage) => item.is_system) || [];
		this.cdr.detectChanges();
	}

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
				})
			}
			this._store.systemLanguages = languages;
		}
	}

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
		if (!this.user) {
			return;
		}
		try {
			await this._userService.updatePreferredLanguage(payload);
		} catch (error) {
			console.error(`Failed to update user preferred language`);
		}
	}

	public get preferredLanguage(): LanguagesEnum {
		return this._selectorService.preferredLanguage;
	}

	public set preferredLanguage(value: LanguagesEnum) {
		this._selectorService.preferredLanguage = value;
	}

	ngOnDestroy(): void { }
}
