import { Component, OnInit, OnDestroy } from '@angular/core';
import { NbDialogService } from '@nebular/theme';
import {
	IEmailHistory,
	IEmployee,
	IOrganization,
	IOrganizationContact,
	LanguagesEnum
} from '@gauzy/contracts';
import { filter, tap, debounceTime } from 'rxjs/operators';
import { Subject, firstValueFrom } from 'rxjs';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { distinctUntilChange } from '@gauzy/common-angular';
import { EmailFiltersComponent } from './email-filters/email-filters.component';
import { TranslationBaseComponent } from '../../../@shared/language-base';
import {
	EmailService,
	EmployeesService,
	OrganizationContactService,
	Store,
	ToastrService
} from '../../../@core/services';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-email-history',
	templateUrl: './email-history.component.html',
	styleUrls: ['./email-history.component.scss']
})
export class EmailHistoryComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {

	loading: boolean = false;
	selectedEmail: IEmailHistory;
	filteredCount: Number;
	thresholdHitCount = 1;
	pageSize = 10;
	imageUrl: string;
	filters = {};
	disableLoadMore: boolean = false;
	totalNoPage: number;
	nextDataLoading: boolean = false;

	organizationContacts: IOrganizationContact[] = [];
	emails: IEmailHistory[] = [];
	employees: IEmployee[] = [];
	private organization: IOrganization;
	emails$: Subject<any> = new Subject();

	constructor(
		private readonly dialogService: NbDialogService,
		private readonly emailService: EmailService,
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
				tap((organization: IOrganization) => this.organization = organization),
				tap(() => this.loading = true),
				tap(() => this.resetFilters()),
				tap(() => this._getEmployees()),
				tap(() => this._getOrganizationContacts()),
				tap(() => this.loading = false),
				untilDestroyed(this)
			)
			.subscribe();
	}

	selectEmail(email: IEmailHistory) {
		this.selectedEmail = email;
		this.selectedEmail.content =
			email.content ?
				email.content :
				email.emailTemplate.hbs;
	}

	async openFiltersDialog() {
		const filters = await firstValueFrom(
			this.dialogService.open(EmailFiltersComponent, {
				context: {
					filters: this.filters
				}
			}).onClose
		);
		if (filters) {
			this.filters = filters;
			this.filteredCount = Object.values(filters).filter(Boolean).length;
			this.emails$.next(true);
		}
	}

	getEmailLanguageFullName(languageCode: LanguagesEnum) {
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
			const { tenantId } = this.store.user;
			const { id: organizationId } = this.organization;

			await this.emailService.getAll(['emailTemplate', 'user'],
				{
					organizationId,
					tenantId,
					isArchived: false,
					...(this.filters ? this.filters : {})
				},
				this.thresholdHitCount * this.pageSize
			)
				.then((data) => {
					this.emails = data.items;
					this.selectedEmail = this.emails ? this.emails[0] : null;
					const totalNoPage = Math.ceil(data.total / this.pageSize)

					if (this.thresholdHitCount >= totalNoPage) {
						this.disableLoadMore = true
					} else {
						this.disableLoadMore = false
					}
				}).finally(() => {
					this.nextDataLoading = false;
				});
		} catch (error) {
			this.toastrService.danger(
				error,
				this.getTranslation('TOASTR.TITLE.ERROR')
			);
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
				}))
		).items;
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
			this.toastrService.success(
				this.getTranslation('SETTINGS.EMAIL_HISTORY.EMAIL_ARCHIVED')
			);
		} catch (error) {
			this.toastrService.danger(error);
		} finally {
			this.emails$.next(true);
		}
	}

	getEmailDate(createdAt: string): string {
		const date = createdAt.slice(0, 10);
		const time = createdAt.slice(11, 19);
		return `${date} ${time}`;
	}

	loadNext() {
		if (this.disableLoadMore || this.nextDataLoading) {
			return
		}
		this.nextDataLoading = true;
		this.thresholdHitCount++;
		this.emails$.next(true);
	}

	getUrl(email: string): string {
		let employee: IEmployee;
		let organizationContact: IOrganizationContact;

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
			return '../../../../assets/images/avatars/avatar-default.svg';
		}
	}

	public resetFilters() {
		this.filters = {};
		this.filteredCount = 0;
	}

	ngOnDestroy() { }
}
