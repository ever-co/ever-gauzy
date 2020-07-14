import { Component, OnInit, OnDestroy } from '@angular/core';
import { Store } from 'apps/gauzy/src/app/@core/services/store.service';
import { EmailTemplateService } from 'apps/gauzy/src/app/@core/services/email-template.service';
import { EmailTemplate, Email } from '@gauzy/models';
import { NbDialogRef } from '@nebular/theme';
import { EmailService } from 'apps/gauzy/src/app/@core/services/email.service';

@Component({
	selector: 'ngx-email-filters',
	templateUrl: './email-filters.component.html',
	styleUrls: ['./email-filters.component.scss']
})
export class EmailFiltersComponent implements OnInit, OnDestroy {
	constructor(
		private store: Store,
		private emailTemplateService: EmailTemplateService,
		private dialogRef: NbDialogRef<EmailFiltersComponent>,
		private emailService: EmailService
	) {}

	emailTemplates: EmailTemplate[];

	selectedTemplateId: string;

	emailTo: string;

	emails?: Email;

	to: Object[] = [];

	organizationId: string;

	filters = [];

	ngOnInit() {
		this._getAllEmailTemplates();
		this._getEmails();
		this.emailTo = this.filters.email;
		this.selectedTemplateId = this.filters.emailTemplateId;
	}

	formatTemplateName(name: string, languageCode: string) {
		const formatedName = name.split('/')[0].split('-').join(' ');
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
		this.dialogRef.close({
			emailTemplateId: this.selectedTemplateId,
			email: this.emailTo
		});
	}

	cancel(emails: Email[] = []) {
		this.dialogRef.close(emails);
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
	private async _getEmails() {
		const { items } = await this.emailService.getAll(['emailTemplate']);
		items.forEach((i) => {
			this.to = [...this.to, { email: i.email }];
		});
	}

	ngOnDestroy() {}
}
