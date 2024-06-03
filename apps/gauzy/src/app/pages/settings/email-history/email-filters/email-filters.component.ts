import { Component, OnInit, OnDestroy, Input } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import { IEmailTemplate, IEmailHistory, IOrganization, LanguagesEnum } from '@gauzy/contracts';
import { filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { distinctUntilChange } from '@gauzy/ui-sdk/common';
import { Store } from '@gauzy/ui-sdk/common';
import { EmailService, EmailTemplateService } from './../../../../@core/services';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-email-filters',
	templateUrl: './email-filters.component.html',
	styleUrls: ['./email-filters.component.scss']
})
export class EmailFiltersComponent implements OnInit, OnDestroy {
	constructor(
		private readonly store: Store,
		private readonly emailTemplateService: EmailTemplateService,
		private readonly dialogRef: NbDialogRef<EmailFiltersComponent>,
		private readonly emailService: EmailService
	) {}

	public organization: IOrganization;
	selectedTemplateId: string;
	emailTo: string;
	emails?: IEmailHistory;
	to: Object[] = [];
	emailTemplates: IEmailTemplate[] = [];

	@Input() set filters(filters: any) {
		this.emailTo = filters.email;
		this.selectedTemplateId = filters.emailTemplateId;
	}

	ngOnInit() {
		this.store.selectedOrganization$
			.pipe(
				distinctUntilChange(),
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => {
					this.organization = organization;
				}),
				tap(() => {
					this._getAllEmailTemplates();
					this._getEmails();
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	formatTemplateName(name: string, languageCode: string) {
		const formattedName = name.split('/')[0].split('-').join(' ');
		return this._toTitleCase(formattedName) + ' - ' + this.getEmailLanguageFullName(languageCode);
	}

	getEmailLanguageFullName(languageCode: string) {
		switch (languageCode) {
			case LanguagesEnum.ENGLISH:
				return 'English';
			case LanguagesEnum.BULGARIAN:
				return 'Bulgarian';
			case LanguagesEnum.HEBREW:
				return 'Hebrew';
			case LanguagesEnum.RUSSIAN:
				return 'Russian';
		}
	}

	submitFilters() {
		this.dialogRef.close({
			emailTemplateId: this.selectedTemplateId,
			email: this.emailTo
		});
	}

	cancel(emails: IEmailHistory[] = []) {
		this.dialogRef.close(emails);
	}

	private _toTitleCase(str: string) {
		return str.replace(/\w\S*/g, (txt) => {
			return txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase();
		});
	}

	private async _getAllEmailTemplates() {
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		const { items } = await this.emailTemplateService.getAll({
			organizationId,
			tenantId
		});

		// Remove repeating template names
		this.emailTemplates = items.filter((et) => et.name.includes('html'));

		this.emailTemplates.forEach((et) => (et.name = this.formatTemplateName(et.name, et.languageCode)));
	}

	private async _getEmails() {
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

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
