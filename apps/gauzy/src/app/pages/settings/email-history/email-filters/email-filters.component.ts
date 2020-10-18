import { Component, OnInit, OnDestroy } from '@angular/core';
import { EmailTemplateService } from 'apps/gauzy/src/app/@core/services/email-template.service';
import { IEmailTemplate, IEmail, IOrganization } from '@gauzy/models';
import { NbDialogRef } from '@nebular/theme';
import { EmailService } from 'apps/gauzy/src/app/@core/services/email.service';

@Component({
	selector: 'ngx-email-filters',
	templateUrl: './email-filters.component.html',
	styleUrls: ['./email-filters.component.scss']
})
export class EmailFiltersComponent implements OnInit, OnDestroy {
	constructor(
		private emailTemplateService: EmailTemplateService,
		private dialogRef: NbDialogRef<EmailFiltersComponent>,
		private emailService: EmailService
	) {}

	emailTemplates: IEmailTemplate[];

	selectedTemplateId: string;

	emailTo: string;

	emails?: IEmail;

	to: Object[] = [];

	organizationId: string;

	filters: any;
	organization: IOrganization;
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

	cancel(emails: IEmail[] = []) {
		this.dialogRef.close(emails);
	}

	private _toTitleCase(str: string) {
		return str.replace(/\w\S*/g, (txt) => {
			return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
		});
	}

	private async _getAllEmailTemplates() {
		const { id: organizationId, tenantId } = this.organization;
		const { items } = await this.emailTemplateService.getAll([], {
			organizationId,
			tenantId
		});

		// Remove repeating template names
		this.emailTemplates = items.filter((et) => et.name.includes('html'));

		this.emailTemplates.forEach(
			(et) =>
				(et.name = this.formatTemplateName(et.name, et.languageCode))
		);
	}
	private async _getEmails() {
		const { id: organizationId, tenantId } = this.organization;
		const { items } = await this.emailService.getAll(['emailTemplate'], {
			organizationId,
			tenantId
		});
		items.forEach((i) => {
			this.to = [...this.to, { email: i.email }];
		});
	}

	ngOnDestroy() {}
}
