import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { LanguagesService } from '../../../@core/services/languages.service';
import { Language } from '@gauzy/models';

@Component({
	selector: 'ngx-language-input',
	templateUrl: './language-input.component.html',
	styleUrls: ['./language-input.component.scss']
})
export class LanguageInputComponent implements OnInit {
	languages: Language[];
	loading = false;

	@Input('selectedLanguage')
	selectedLanguage: Language;

	@Output()
	selectedLanguageEvent = new EventEmitter<Language>();

	constructor(private readonly languagesService: LanguagesService) {}

	async onChange(currentSelection: Language) {
		this.selectedLanguageEvent.emit(currentSelection);
	}

	addLanguage = async (languageName: string) => {
		const newLanguage: Language = {
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
	}

	async getAllLanguages() {
		const { items } = await this.languagesService.getAllLanguages();
		this.languages = items;
	}
}
