import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { LanguagesService } from '../../../@core/services/languages.service';
import { ILanguage } from '@gauzy/contracts';

@Component({
	selector: 'ngx-language-input',
	templateUrl: './language-input.component.html',
	styleUrls: ['./language-input.component.scss']
})
export class LanguageInputComponent implements OnInit {
	languages: ILanguage[];
	loading = false;

	@Input('selectedLanguage')
	selectedLanguage: ILanguage;

	@Output()
	selectedLanguageEvent = new EventEmitter<ILanguage>();

	constructor(private readonly languagesService: LanguagesService) {}

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
	}

	async getAllLanguages() {
		const { items } = await this.languagesService.getAllLanguages();
		this.languages = items;
	}
}
