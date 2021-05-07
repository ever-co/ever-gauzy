import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { LanguagesService } from '../../../@core/services/languages.service';
import { ILanguage } from '@gauzy/contracts';
import { TranslationBaseComponent } from '../../language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';
import { Store } from '../../../@core';
import { filter, tap } from 'rxjs/operators';
import { NbComponentSize } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-language-selector',
	templateUrl: './language-selector.component.html',
	styleUrls: ['./language-selector.component.scss']
})
export class LanguageSelectorComponent extends TranslationBaseComponent implements OnInit {
	languages: ILanguage[];
	loading: boolean;

	/*
	* Getter & Setter for dynamic placeholder
	*/
	_placeholder: string = this.getTranslation('MENU.LANGUAGE');
	get placeholder(): string {
		return this._placeholder;
	}
	@Input() set placeholder(value: string) {
		this._placeholder = value;
	}

	/*
	* Getter & Setter for dynamic clearable option
	*/
	_clearable: boolean;
	get clearable(): boolean {
		return this._clearable;
	}
	@Input() set clearable(value: boolean) {
		this._clearable = value;
	}

	/*
	* Getter & Setter for dynamic add tag option
	*/
	_addTag: boolean;
	get addTag(): boolean {
		return this._addTag;
	}
	@Input() set addTag(value: boolean) {
		this._addTag = value;
	}

	/*
	* Getter & Setter for automatic language selection as per selected language code
	*/
	_selectedLanguageCode: string;
	get selectedLanguageCode(): string {
		return this._selectedLanguageCode;
	}
	@Input() set selectedLanguageCode(value: string) {
		if (value) {
			this._selectedLanguageCode = value;
		}
	}

	/*
	* Getter & Setter for dynamic template
	*/
	_template: string;
	get template(): string {
		return this._template;
	}
	@Input() set template(value: string) {
		this._template = value;
	}

	/*
	* Getter & Setter for dynamic template
	*/
	_size: NbComponentSize = 'medium';
	get size(): NbComponentSize {
		return this._size;
	}
	@Input() set size(value: NbComponentSize) {
		this._size = value;
	}

	_isSystemLanguage: boolean = false;
	get isSystemLanguage(): boolean {
		return this._isSystemLanguage;
	}
	@Input() set isSystemLanguage(value: boolean) {
		this._isSystemLanguage = value;
	}

	@Output() selectedLanguageEvent = new EventEmitter<ILanguage>();

	constructor(
		private readonly languagesService: LanguagesService,
		readonly translate: TranslateService,
		private readonly store: Store
	) {
		super(translate);
		this.store.preferredLanguage$
			.pipe(
				filter((preferredLanguage: string) => !!preferredLanguage),
				tap((preferredLanguage: string) => this.selectedLanguageCode = preferredLanguage),
				untilDestroyed(this)
			)
			.subscribe();
	}

	onChange(currentSelection: ILanguage) {
		this.selectedLanguageEvent.emit(currentSelection);
	}

	onSelectedChange(code: ILanguage['code']) {
		const selectedLanguage = this.getLanguageByCode(code);
		this.selectedLanguageEvent.emit(selectedLanguage);
	}

	addLanguage = async (languageName: string) => {
		const newLanguage: ILanguage = {
			name: languageName,
			color: '#' + Math.floor(Math.random() * 16777215).toString(16),
			description: ''
		};
		this.loading = true;
		const language = await this.languagesService.insertLanguage(
			newLanguage
		);
		this.loading = false;
		return language;
	};

	async ngOnInit() {
		if (!this.isSystemLanguage) {
			await this.getAllLanguages();
		} else {
			await this.getSystemLanguages();
		}
		this.checkPreFilledLanguage();
	}

	async getAllLanguages() {
		const { items } = await this.languagesService.getAllLanguages();
		this.languages = items;
	}

	async getSystemLanguages() {
		const { items } = await this.languagesService.getSystemLanguages();
		this.languages = items;
	}

	checkPreFilledLanguage() {
		if (!this.selectedLanguageCode) {
			return;
		}
		if (this.languages.length > 0) {
			const selectedLanguage = this.getLanguageByCode(this.selectedLanguageCode);
			this.onChange(selectedLanguage);
		}
	}

	getLanguageByCode(code: ILanguage['code']) {
		return this.languages.find(
			(language: ILanguage) => code === language.code
		);
	}
}
