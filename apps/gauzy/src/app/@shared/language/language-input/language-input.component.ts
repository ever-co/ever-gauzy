import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { LanguagesService } from '../../../@core/services/languages.service';
import { ILanguage } from '@gauzy/contracts';
import { TranslationBaseComponent } from '../../language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';
import { Store } from '../../../@core';
import { filter, tap } from 'rxjs/operators';

@Component({
	selector: 'ngx-language-selector',
	templateUrl: './language-input.component.html',
	styleUrls: ['./language-input.component.scss']
})
export class LanguageInputComponent extends TranslationBaseComponent implements OnInit {
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
				tap((preferredLanguage: string) => this.selectedLanguageCode = preferredLanguage)
			)
			.subscribe();
	}

	async onChange(currentSelection: ILanguage) {
		this.selectedLanguageEvent.emit(currentSelection);
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
		await this.getAllLanguages();
		this.checkPreFilledLanguage();
	}

	async getAllLanguages() {
		const { items } = await this.languagesService.getAllLanguages();
		this.languages = items;
	}

	checkPreFilledLanguage() {
		if (!this.selectedLanguageCode) {
			return;
		}
		if (this.languages.length > 0) {
			const selectedLanguage = this.languages.find(
				(language: ILanguage) => this.selectedLanguageCode === language.code
			);
			this.onChange(selectedLanguage);
		}
	}
}
