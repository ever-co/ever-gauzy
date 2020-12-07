import { Component, OnInit, OnDestroy } from '@angular/core';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { Subject } from 'rxjs';
import { EmailService } from '../../../@core/services/email.service';
import {
	IEmail,
	IEmployee,
	IOrganization,
	IOrganizationContact
} from '@gauzy/models';
import { DomSanitizer } from '@angular/platform-browser';
import { Store } from '../../../@core/services/store.service';
import { takeUntil, first } from 'rxjs/operators';
import { EmailFiltersComponent } from './email-filters/email-filters.component';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { EmployeesService } from '../../../@core/services';
import { OrganizationContactService } from '../../../@core/services/organization-contact.service';

export interface DisplayEmail {
	from: string;
	to: string;
	date: string;
}

@Component({
	selector: 'ngx-email-history',
	templateUrl: './email-history.component.html',
	styleUrls: ['./email-history.component.scss']
})
export class EmailHistoryComponent
	extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	private _onDestroy$ = new Subject<void>();

	private _selectedOrganization: IOrganization;

	loading = true;

	emails: IEmail[];

	employees: IEmployee[];

	organizationContacts: IOrganizationContact[];

	selectedEmail: IEmail;

	filteredCount: Number;

	threshholdHitCount = 1;

	pageSize = 10;

	imageUrl: string;

	filters = [];

	get selectedEmailHTML() {
		return this.sanitizer.bypassSecurityTrustHtml(
			this.selectedEmail.content
		);
	}

	constructor(
		private dialogService: NbDialogService,
		private emailService: EmailService,
		private sanitizer: DomSanitizer,
		private store: Store,
		private toastrService: NbToastrService,
		private organizationContactService: OrganizationContactService,
		private employeesService: EmployeesService,
		readonly translateService: TranslateService
	) {
		super(translateService);
	}

	ngOnInit() {
		this.store.selectedOrganization$
			.pipe(takeUntil(this._onDestroy$))
			.subscribe((org) => {
				if (org) {
					this._selectedOrganization = org;
					const {
						id: organizationId,
						tenantId
					} = this._selectedOrganization;
					this.resetFilters();
					this._getSelectedOrganizationEmails(
						organizationId,
						tenantId
					);
					this._getEmployees(organizationId, tenantId);
					this._getOrganizationContacts();
					this.loading = false;
				}
			});
	}

	selectEmail(email: IEmail) {
		this.selectedEmail = email;
	}

	async openFiltersDialog() {
		const filters = await this.dialogService
			.open(EmailFiltersComponent, {
				context: {
					filters: this.filters,
					organization: this._selectedOrganization
				}
			})
			.onClose.pipe(first())
			.toPromise();

		if (filters) {
			const { id: organizationId, tenantId } = this._selectedOrganization;
			this._getSelectedOrganizationEmails(
				organizationId,
				tenantId,
				filters
			);
			const getCount = function (obj) {
				return Object.values(obj).filter(
					(value) => typeof value !== 'undefined'
				);
			};
			this.filters = filters;
			this.filteredCount = getCount(filters).length;
		}
	}

	getEmailLanguageFullName(languageCode: 'en' | 'bg' | 'he' | 'ru') {
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

	private async _getSelectedOrganizationEmails(
		organizationId: string,
		tenantId: string,
		filters?: any
	) {
		try {
			await this.emailService
				.getAll(
					['emailTemplate', 'user'],
					{
						organizationId,
						tenantId,
						isArchived: false || null,
						...filters
					},
					this.threshholdHitCount * this.pageSize
				)
				.then((data) => {
					this.emails = data.items;
					// this.loading = false;

					this.selectedEmail = this.emails ? this.emails[0] : null;
				});
		} catch (error) {
			this.toastrService.danger(
				this.getTranslation('TOASTR.TITLE.ERROR')
			);
			console.error(error);
			// this.loading = false;
		}
	}

	private async _getEmployees(organizationId: string, tenantId: string) {
		const { items } = await this.employeesService
			.getAll(['user'], { organizationId, tenantId })
			.pipe(first())
			.toPromise();
		this.employees = items;
	}

	private async _getOrganizationContacts() {
		const { items } = await this.organizationContactService.getAll();
		this.organizationContacts = items;
	}

	async archive() {
		if (!this.selectedEmail) {
			return;
		}
		await this.emailService.update(this.selectedEmail.id, {
			isArchived: true
		});
		this._getSelectedOrganizationEmails(
			this._selectedOrganization.id,
			this._selectedOrganization.tenantId,
			this.filters
		);
		this.toastrService.primary(
			this.getTranslation('SETTINGS.EMAIL_HISTORY.EMAIL_ARCHIVED'),
			this.getTranslation('TOASTR.TITLE.SUCCESS')
		);
	}

	getEmailDate(createdAt: string): string {
		const date = createdAt.slice(0, 10);
		const time = createdAt.slice(11, 19);
		return `${date} ${time}`;
	}

	loadNext() {
		this.threshholdHitCount++;
		this._getSelectedOrganizationEmails(
			this._selectedOrganization.id,
			this._selectedOrganization.tenantId,
			this.filters
		);
	}

	getUrl(email: string): string {
		let employee;
		let organizationContact;
		if (this.employees) {
			employee = this.employees.find((e) => e.user.email === email);
		}

		if (this.organizationContacts) {
			organizationContact = this.organizationContacts.find(
				(oc) => oc.primaryEmail === email
			);
		}

		if (employee) {
			return employee.user.imageUrl;
		} else if (organizationContact) {
			return organizationContact.imageUrl;
		} else {
			return '../../../../assets/images/avatar-default.svg';
		}
	}

	public resetFilters() {
		this.filters = [];
		this.filteredCount = 0;
	}

	ngOnDestroy() {
		this._onDestroy$.next();
		this._onDestroy$.complete();
	}
}
