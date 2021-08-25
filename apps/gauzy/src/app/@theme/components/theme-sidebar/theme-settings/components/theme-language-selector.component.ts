import { Component, OnInit, OnDestroy, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { ILanguage, IUser, LanguagesEnum } from '@gauzy/contracts';
import { LanguagesService, Store, UsersService } from './../../../../../@core/services';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { NbLayoutDirection, NbLayoutDirectionService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-theme-language-selector',
	styleUrls: ['./theme-language-selector.component.scss'],
	templateUrl: './theme-language-selector.component.html',
})
export class ThemeLanguageSelectorComponent implements OnInit, OnDestroy, AfterViewInit {

	user: IUser;
	languages: ILanguage[] = [];
	currentLang: string = LanguagesEnum.ENGLISH;
	
	constructor(
		private readonly _store: Store,
		private readonly _userService: UsersService,
		private readonly _directionService: NbLayoutDirectionService,
		private readonly _translate: TranslateService,
		private readonly _languagesService: LanguagesService,
		private readonly cdr: ChangeDetectorRef
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
				filter((user: IUser) => !!user),
				debounceTime(150),
				tap((user: IUser) => (this.user = user)),
				untilDestroyed(this)
			)
			.subscribe((user: IUser) => {
				if (
					user.preferredLanguage &&
					user.preferredLanguage !== this.currentLang
				) {
					this.currentLang = user.preferredLanguage;
				}
				this.switchLanguage();
			});
		this._store.preferredLanguage$
			.pipe(
				filter((preferredLanguage) => !!preferredLanguage),
				debounceTime(150),
				tap((preferredLanguage) => this.currentLang = preferredLanguage),
				tap(() => this.setLanguage()),
				untilDestroyed(this)
			)
			.subscribe();
	}

 	ngAfterViewInit() {
		const systemLanguages = this._store.systemLanguages;
		if (!systemLanguages) {
			(async() => {
				await this._loadLanguages();
			})();
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
		this._store.preferredLanguage = this.currentLang;
	}

	setLanguage() {
		if (this.currentLang === LanguagesEnum.HEBREW) {
			this._directionService.setDirection(NbLayoutDirection.RTL);
		} else {
			this._directionService.setDirection(NbLayoutDirection.LTR);
		}

		this.changePreferredLanguage({
			preferredLanguage: this._store.preferredLanguage
		});

		this._translate.use(this.currentLang || LanguagesEnum.ENGLISH);
	}

	private async changePreferredLanguage(data: any) {
		if (!this.user) {
			return;
		}
		try {
			await this._userService.update(this.user.id, data);
		} catch (error) { 			
			console.error(`Failed to update user preferred language`);
		}
	}

	ngOnDestroy(): void { }
}
