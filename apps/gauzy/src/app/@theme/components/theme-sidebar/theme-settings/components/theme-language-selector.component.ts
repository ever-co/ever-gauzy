import { Component, OnInit, OnDestroy, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { ILanguage, IUser, IUserUpdateInput, LanguagesEnum } from '@gauzy/contracts';
import { debounceTime, filter, tap, from, concatMap } from 'rxjs';
import { NbLayoutDirection, NbLayoutDirectionService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { LanguagesService, Store, UsersService } from './../../../../../@core/services';
import { ElectronService } from './../../../../../@core/auth/electron.service';
import { distinctUntilChange } from 'packages/common-angular/dist';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-theme-language-selector',
	styleUrls: ['./theme-language-selector.component.scss'],
	templateUrl: './theme-language-selector.component.html',
})
export class ThemeLanguageSelectorComponent implements OnInit, OnDestroy, AfterViewInit {

	user: IUser;
	languages: ILanguage[] = [];
	preferredLanguage: LanguagesEnum = LanguagesEnum.ENGLISH;

	constructor(
		private readonly _store: Store,
		private readonly _userService: UsersService,
		private readonly _directionService: NbLayoutDirectionService,
		private readonly _translate: TranslateService,
		private readonly _languagesService: LanguagesService,
		private readonly cdr: ChangeDetectorRef,
		private readonly _electronService: ElectronService
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
				tap(() => this.setLanguage()),
				tap((preferredLanguage: LanguagesEnum) => {
					if (this._electronService.isElectron) {
						this._electronService.ipcRenderer.send(
							'preferred_language_change',
							preferredLanguage
						);
					}
				}),
				concatMap((preferredLanguage: LanguagesEnum) =>
					this.changePreferredLanguage({
						preferredLanguage,
					})
				),
				untilDestroyed(this)
			)
			.subscribe();
	}

 	ngAfterViewInit() {
		const systemLanguages = this._store.systemLanguages;
		if (!systemLanguages) {
			  from(this._loadLanguages()).subscribe();
		  };
		  if (this._electronService.isElectron) {
			  from(this._electronService.ipcRenderer.invoke('PREFERRED_LANGUAGE'))
				  .pipe(
					  tap((language: LanguagesEnum) => {
						  this.preferredLanguage = language;
						  this.switchLanguage();
					  }),
					  untilDestroyed(this)
				  )
				  .subscribe();
		  }
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

	setLanguage() {
		if (this.preferredLanguage === LanguagesEnum.HEBREW) {
			this._directionService.setDirection(NbLayoutDirection.RTL);
		} else {
			this._directionService.setDirection(NbLayoutDirection.LTR);
		}
		this._translate.use(this.preferredLanguage || LanguagesEnum.ENGLISH);
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

	ngOnDestroy(): void { }
}
