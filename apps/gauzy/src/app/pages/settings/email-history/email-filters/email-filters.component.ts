import { Component, OnInit } from '@angular/core';
import { Store } from 'apps/gauzy/src/app/@core/services/store.service';
import { EmailTemplateService } from 'apps/gauzy/src/app/@core/services/email-template.service';
import { EmailTemplate } from '@gauzy/models';
import { NbDialogRef } from '@nebular/theme';

@Component({
	selector: 'ngx-email-filters',
	templateUrl: './email-filters.component.html',
	styleUrls: ['./email-filters.component.scss']
})
export class EmailFiltersComponent implements OnInit {
	constructor(
		private store: Store,
		private emailTemplateService: EmailTemplateService,
		private dialogRef: NbDialogRef<EmailFiltersComponent>
	) {}

	emailTemplates: EmailTemplate[];

	selectedTemplateId: string;

	ngOnInit() {
		this._getAllEmailTemplates();
	}

	formatTemplateName(name: string, languageCode: string) {
		const formatedName = name
			.split('/')[0]
			.split('-')
			.join(' ');
		return (
			this._toTitleCase(formatedName) +
			' - ' +
			this.getEmailLanguageFullName(languageCode)
		);
	}

	getEmailLanguageFullName(languageCode: string) {
		switch (languageCode) {
			case 'en':
				return 'English';
			case 'bg':
				return 'Bulgarian';
			case 'he':
				return 'Hebrew';
			case 'ru':
				return 'Russian';
		}
	}

	submitFilters() {
		console.log(this.selectedTemplateId);
		this.dialogRef.close({
			emailTemplateId: this.selectedTemplateId
			// userId:
		});
	}

	private _toTitleCase(str: string) {
		return str.replace(/\w\S*/g, (txt) => {
			return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
		});
	}

	private async _getAllEmailTemplates() {
		const { items } = await this.emailTemplateService.getAll();

		// Remove repeating template names
		this.emailTemplates = items.filter((et) => et.name.includes('html'));

		this.emailTemplates.forEach(
			(et) =>
				(et.name = this.formatTemplateName(et.name, et.languageCode))
		);
	}
}
