import { AfterViewInit, Component, Input, NgZone, OnInit } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { ILanguage, IUser, IUserUpdateInput, LanguagesEnum } from '@gauzy/contracts';
import { distinctUntilChange } from '@gauzy/ui-core/common';
import { UserOrganizationService } from '../time-tracker/organization-selector/user-organization.service';
import { LanguageService } from './language.service';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { tap, filter, from, BehaviorSubject, Observable, concatMap, Subject } from 'rxjs';
import { Store } from '../services';
import { LanguageSelectorService } from './language-selector.service';
import { ElectronService } from '../electron/services';

@UntilDestroy({ checkProperties: true })
@Component({
    selector: 'gauzy-language-selector',
    templateUrl: './language-selector.component.html',
    styleUrls: ['./language-selector.component.scss'],
    standalone: false
})
export class LanguageSelectorComponent implements OnInit, AfterViewInit {
	private _user: IUser;
	private _languages$: BehaviorSubject<ILanguage[]>;
	private _preferredLanguage: LanguagesEnum;
	private _isSetup: boolean;
	private _update$: Subject<LanguagesEnum>;

	constructor(
		private readonly _store: Store,
		private readonly _userService: UserOrganizationService,
		private readonly _translate: TranslateService,
		private readonly _languageService: LanguageService,
		private readonly _languageSelectorService: LanguageSelectorService,
		private readonly _electronService: ElectronService,
		private readonly _ngZone: NgZone
	) {
		this._languages$ = new BehaviorSubject([]);
		this._preferredLanguage = LanguagesEnum.ENGLISH;
		this._update$ = new Subject();
		this._isSetup = false;
	}

	ngOnInit(): void {
		this._store.systemLanguages$
			.pipe(
				filter((languages: ILanguage[]) => !!languages),
				tap((languages: ILanguage[]) => this.systemLanguages(languages)),
				untilDestroyed(this)
			)
			.subscribe();
		this._store.user$
			.pipe(
				filter((user: IUser) => !!user),
				tap((user: IUser) => (this._user = user)),
				tap(({ preferredLanguage }: IUser) => {
					if (!this._store.preferredLanguage) {
						this._store.preferredLanguage = preferredLanguage || LanguagesEnum.ENGLISH;
					}
				}),
				untilDestroyed(this)
			)
			.subscribe();
		this._update$
			.pipe(
				filter((preferredLanguage: LanguagesEnum) => !!preferredLanguage),
				distinctUntilChange(),
				tap((preferredLanguage: LanguagesEnum) => (this._preferredLanguage = preferredLanguage)),
				tap(() => this.setLanguage()),
				tap((preferredLanguage: LanguagesEnum) =>
					this._electronService.ipcRenderer.send('preferred_language_change', preferredLanguage)
				),
				filter(() => !this.isSetup || !this._store.isOffline),
				tap((preferredLanguage: LanguagesEnum) => (this._store.preferredLanguage = preferredLanguage)),
				concatMap((preferredLanguage: LanguagesEnum) =>
					this.changePreferredLanguage({
						preferredLanguage
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
		}
		this._electronService.ipcRenderer.on('preferred_language_change', (event, language: LanguagesEnum) => {
			this._ngZone.run(async () => {
				this.updatePreferredLanguage = language;
			});
		});
		from(this._electronService.ipcRenderer.invoke('PREFERRED_LANGUAGE'))
			.pipe(
				tap((language: LanguagesEnum) => {
					this.updatePreferredLanguage = language;
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	private async _loadLanguages() {
		const { items = [] } =
			this.isSetup || this._store.isOffline ? { items: [] } : await this._languageService.system();
		this._store.systemLanguages = items.filter((item: ILanguage) => item.is_system) || [];
	}

	public systemLanguages(systemLanguages: ILanguage[]) {
		if (systemLanguages && systemLanguages.length > 0) {
			this._languages$.next(
				systemLanguages
					.filter((item) => !!item.is_system)
					.map((item) => {
						return {
							value: item.code,
							name: 'SETTINGS_MENU.' + item.name.toUpperCase()
						};
					})
			);
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

	public async switchLanguage(): Promise<void> {
		this.updatePreferredLanguage = this._preferredLanguage;
	}

	public setLanguage(): void {
		this._languageSelectorService.setLanguage(this.preferredLanguage, this._translate);
	}

	private async changePreferredLanguage(payload: IUserUpdateInput) {
		if (!this._user || !this._user.tenantId) {
			return;
		}
		try {
			await this._userService.updatePreferredLanguage(payload);
		} catch (error) {
			console.error(`Failed to update user preferred language`);
		}
	}

	public get languages$(): Observable<ILanguage[]> {
		return this._languages$.asObservable();
	}

	public get preferredLanguage(): LanguagesEnum {
		return this._preferredLanguage;
	}

	public set preferredLanguage(value: LanguagesEnum) {
		this._preferredLanguage = value;
	}

	public set updatePreferredLanguage(language: LanguagesEnum) {
		if (language) {
			this._update$.next(language);
		}
	}

	@Input('setup')
	public set isSetup(value: boolean) {
		this._isSetup = value;
	}

	public get isSetup(): boolean {
		return this._isSetup;
	}
}
