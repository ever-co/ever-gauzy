import { Component, OnInit, OnDestroy } from '@angular/core';
import {
	EmailStatusEnum,
	IEmailFindInput,
	IEmailHistory,
	IEmailTemplate,
	IEmployee,
	IOrganization,
	IOrganizationContact,
	LanguagesEnum
} from '@gauzy/contracts';
import { filter, tap, debounceTime } from 'rxjs/operators';
import { Subject, firstValueFrom } from 'rxjs';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { distinctUntilChange } from '@gauzy/ui-core/common';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import {
	EmailService,
	EmailTemplateService,
	EmployeesService,
	OrganizationContactService,
	Store,
	ToastrService
} from '@gauzy/ui-core/core';

/** One option in the Template filter: grouped by `title`, the language shown beside it. */
interface ITemplateOption {
	id: string;
	title: string;
	language: string;
	label: string;
}

/** A removable label under the filter bar, one per active filter. */
interface IActiveFilter {
	key: 'recipient' | 'template' | 'status' | 'archived';
	label: string;
	value?: string;
}

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-email-history',
	templateUrl: './email-history.component.html',
	styleUrls: ['./email-history.component.scss'],
	standalone: false
})
export class EmailHistoryComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	loading: boolean = false;
	selectedEmail: IEmailHistory;
	thresholdHitCount = 1;
	pageSize = 10;
	imageUrl: string;
	disableLoadMore: boolean = false;
	totalNoPage: number;
	nextDataLoading: boolean = false;
	EmailStatusEnum: typeof EmailStatusEnum = EmailStatusEnum;

	// ── Filters ──────────────────────────────────────────────────────────
	recipientFilter: string = null;
	templateFilter: string = null;
	statusFilter: EmailStatusEnum = null;
	showArchived = false;

	/** Every address we know of: employees, contacts and whoever the loaded emails went to. */
	recipients: { email: string }[] = [];
	templateOptions: ITemplateOption[] = [];
	statusOptions = [EmailStatusEnum.SENT, EmailStatusEnum.FAILED];
	/** Total emails the API reports for the current filters (the list loads them a page at a time). */
	total = 0;

	organizationContacts: IOrganizationContact[] = [];
	emails: IEmailHistory[] = [];
	employees: IEmployee[] = [];
	private organization: IOrganization;
	emails$: Subject<any> = new Subject();

	constructor(
		private readonly emailService: EmailService,
		private readonly emailTemplateService: EmailTemplateService,
		private readonly store: Store,
		private readonly toastrService: ToastrService,
		private readonly organizationContactService: OrganizationContactService,
		private readonly employeesService: EmployeesService,
		readonly translateService: TranslateService
	) {
		super(translateService);
	}

	ngOnInit() {
		this.emails$
			.pipe(
				debounceTime(300),
				tap(() => this._getEmails()),
				untilDestroyed(this)
			)
			.subscribe();
		this.store.selectedOrganization$
			.pipe(
				distinctUntilChange(),
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => (this.organization = organization)),
				tap(() => this.resetFilters()),
				tap(() => this._getEmployees()),
				tap(() => this._getOrganizationContacts()),
				tap(() => this._getTemplateOptions()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	selectEmail(email: IEmailHistory) {
		this.selectedEmail = email;
		this.selectedEmail.content = email.content ? email.content : email.emailTemplate.hbs;
	}

	// ── Filters ──────────────────────────────────────────────────────────

	/**
	 * Any filter change reloads the list from its first page. The selection is cleared:
	 * the open email may not match the new filters.
	 */
	onFiltersChange() {
		this.selectedEmail = null;
		// Show the spinner through the debounce rather than a momentary empty state.
		this.loading = true;
		this.thresholdHitCount = 1;
		this.emails$.next(true);
	}

	get hasActiveFilters(): boolean {
		return this.activeFilters.length > 0;
	}

	/** Built in one expression (no `push`), so the list is never mutated after it is declared. */
	get activeFilters(): IActiveFilter[] {
		const template = this.templateFilter
			? this.templateOptions.find((option) => option.id === this.templateFilter)
			: null;

		const candidates: (IActiveFilter | false)[] = [
			!!this.recipientFilter && {
				key: 'recipient',
				label: 'SETTINGS.EMAIL_HISTORY.FILTERS.RECIPIENT',
				value: this.recipientFilter
			},
			!!this.templateFilter && {
				key: 'template',
				label: 'SETTINGS.EMAIL_HISTORY.FILTERS.TEMPLATE',
				value: template ? template.label : this.templateFilter
			},
			!!this.statusFilter && {
				key: 'status',
				label: 'SETTINGS.EMAIL_HISTORY.FILTERS.STATUS',
				value: this.getTranslation(`SETTINGS.EMAIL_HISTORY.FILTERS.${this.statusFilter}`)
			},
			this.showArchived && { key: 'archived', label: 'SETTINGS.EMAIL_HISTORY.FILTERS.ARCHIVED' }
		];

		return candidates.filter((active): active is IActiveFilter => !!active);
	}

	removeFilter(key: IActiveFilter['key']) {
		switch (key) {
			case 'recipient':
				this.recipientFilter = null;
				break;
			case 'template':
				this.templateFilter = null;
				break;
			case 'status':
				this.statusFilter = null;
				break;
			case 'archived':
				this.showArchived = false;
				break;
		}
		this.onFiltersChange();
	}

	clearFilters() {
		this.resetFilters();
		this.onFiltersChange();
	}

	public resetFilters() {
		this.recipientFilter = null;
		this.templateFilter = null;
		this.statusFilter = null;
		this.showArchived = false;
	}

	/** `where` for the email list. Only filters that are set are sent. */
	private _buildWhere(): IEmailFindInput {
		const { id: organizationId, tenantId } = this.organization;
		return {
			organizationId,
			tenantId,
			isArchived: this.showArchived,
			...(this.recipientFilter ? { email: this.recipientFilter } : {}),
			...(this.templateFilter ? { emailTemplateId: this.templateFilter } : {}),
			...(this.statusFilter ? { status: this.statusFilter } : {})
		};
	}

	getEmailLanguageFullName(languageCode: LanguagesEnum | string) {
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

	private async _getEmails() {
		if (!this.organization) {
			return;
		}

		try {
			this.loading = true;
			await this.emailService
				.getAll(['emailTemplate', 'user'], this._buildWhere(), this.thresholdHitCount * this.pageSize)
				.then((data) => {
					this.emails = data.items.map((email) => ({
						...email,
						avatarUrl: this.getUrl(email),
						formattedDate: this.getEmailDate(email.createdAt)
					}));
					this.total = data.total;
					// Loading more, resending or archiving reloads the list with the same filters:
					// keep the open email while it is still in the results, else open the first.
					const stillListed = this.selectedEmail
						? this.emails.find((email) => email.id === this.selectedEmail.id)
						: null;
					if (stillListed) {
						this.selectEmail(stillListed);
					} else {
						this.selectedEmail = this.emails.length ? this.emails[0] : null;
					}
					this._updateRecipients();
					const totalNoPage = Math.ceil(data.total / this.pageSize);

					if (this.thresholdHitCount >= totalNoPage) {
						this.disableLoadMore = true;
					} else {
						this.disableLoadMore = false;
					}
				})
				.finally(() => {
					this.nextDataLoading = false;
					this.loading = false;
				});
		} catch (error) {
			this.loading = false;
			this.toastrService.danger(error, this.getTranslation('TOASTR.TITLE.ERROR'));
		}
	}

	private async _getEmployees() {
		if (!this.organization) {
			return;
		}

		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		this.employees = (
			await firstValueFrom(
				this.employeesService.getAll(['user'], {
					organizationId,
					tenantId
				})
			)
		).items;
		this._updateRecipients();
	}

	private async _getOrganizationContacts() {
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		this.organizationContacts = (
			await this.organizationContactService.getAll([], {
				organizationId,
				tenantId
			})
		).items;
		this._updateRecipients();
	}

	/**
	 * The Template filter: the HTML variant of each template (the subject and text
	 * variants share its id-less name), grouped by template with the language beside it.
	 */
	private async _getTemplateOptions() {
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		try {
			const { items } = await this.emailTemplateService.getAll({ organizationId, tenantId });
			this.templateOptions = items
				.filter((template: IEmailTemplate) => template.name.includes('html'))
				.map((template: IEmailTemplate) => {
					const title = this._toTitleCase(template.name.split('/')[0].split('-').join(' '));
					const language =
						this.getEmailLanguageFullName(template.languageCode) || template.languageCode || '';
					return { id: template.id, title, language, label: language ? `${title} · ${language}` : title };
				})
				.sort((a, b) => a.title.localeCompare(b.title) || a.language.localeCompare(b.language));
		} catch (error) {
			this.templateOptions = [];
			this.toastrService.danger(error, this.getTranslation('TOASTR.TITLE.ERROR'));
		}
	}

	/** Keeps the Recipient options in sync with every source of addresses, without duplicates. */
	private _updateRecipients() {
		const addresses = [
			...this.employees.map((employee) => employee.user?.email),
			...this.organizationContacts.map((contact) => contact.primaryEmail),
			...this.emails.map((email) => email.email)
		].filter(Boolean);
		this.recipients = [...new Set(addresses)].sort((a, b) => a.localeCompare(b)).map((email) => ({ email }));
	}

	private _toTitleCase(str: string) {
		return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase());
	}

	async archive() {
		if (!this.selectedEmail) {
			return;
		}
		try {
			const { organizationId, tenantId } = this.selectedEmail;
			await this.emailService.update(this.selectedEmail.id, {
				isArchived: true,
				organizationId,
				tenantId
			});
			this.toastrService.success(this.getTranslation('SETTINGS.EMAIL_HISTORY.EMAIL_ARCHIVED'));
		} catch (error) {
			this.toastrService.danger(error);
		} finally {
			this.emails$.next(true);
		}
	}

	async resend() {
		if (!this.selectedEmail) {
			return;
		}
		try {
			const { organizationId, tenantId } = this.selectedEmail;
			await this.emailService.resend(this.selectedEmail.id, {
				organizationId,
				tenantId
			});
			this.toastrService.success(this.getTranslation('SETTINGS.EMAIL_HISTORY.RESEND'));
		} catch (error) {
			this.toastrService.danger(error);
		} finally {
			this.emails$.next(true);
		}
	}

	getEmailDate(createdAt: string | Date): string {
		const dateStr = typeof createdAt === 'string' ? createdAt : createdAt.toISOString();
		const date = dateStr.slice(0, 10);
		const time = dateStr.slice(11, 19);
		return `${date} ${time}`;
	}

	loadNext() {
		if (this.disableLoadMore || this.nextDataLoading) {
			return;
		}
		this.nextDataLoading = true;
		this.thresholdHitCount++;
		this.emails$.next(true);
	}

	getUrl(email: IEmailHistory): string {
		let employee: IEmployee;
		let organizationContact: IOrganizationContact;

		if (this.employees) {
			employee = this.employees.find((e) => e.user.email === email.email);
		}
		if (this.organizationContacts) {
			organizationContact = this.organizationContacts.find((oc) => oc.primaryEmail === email.email);
		}
		if (employee) {
			return employee.user.imageUrl;
		} else if (organizationContact) {
			return organizationContact.imageUrl;
		} else if (!email.user) {
			return '../../../../assets/images/logos/ever.jpg';
		} else {
			return '../../../../assets/images/avatars/avatar-default.svg';
		}
	}

	ngOnDestroy() {}
}
