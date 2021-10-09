import { Component, OnInit, OnDestroy } from '@angular/core';
import { NbDialogService } from '@nebular/theme';
import {
	IEmail,
	IEmployee,
	IOrganization,
	IOrganizationContact,
	LanguagesEnum
} from '@gauzy/contracts';
import { DomSanitizer } from '@angular/platform-browser';
import { first, filter, tap, debounceTime } from 'rxjs/operators';
import { Subject } from 'rxjs';
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
export class EmailHistoryComponent
	extends TranslationBaseComponent
	implements OnInit, OnDestroy {

	loading: boolean;
	emails: IEmail[] = [];
	employees: IEmployee[] = [];
	organizationContacts: IOrganizationContact[] = [];
	selectedEmail: IEmail;
	filteredCount: Number;
	threshholdHitCount = 1;
	pageSize = 10;
	imageUrl: string;
	filters = [];
	disableLoadMore: boolean = false;
	totalNoPage: number;
	nextDataLoading: boolean = false;
	private organization: IOrganization;
	emails$: Subject<any> = new Subject();

	get selectedEmailHTML() {
		return this.sanitizer.bypassSecurityTrustHtml(
			this.selectedEmail.content
		);
	}

	constructor(
		private readonly dialogService: NbDialogService,
		private readonly emailService: EmailService,
		private readonly sanitizer: DomSanitizer,
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

	selectEmail(email: IEmail) {
		this.selectedEmail = email;
	}

	async openFiltersDialog() {
		const filters = await this.dialogService
			.open(EmailFiltersComponent, {
				context: {
					filters: this.filters,
					organization: this.organization
				}
			})
			.onClose.pipe(first())
			.toPromise();

		if (filters) {
			this.emails$.next(true);
			const getCount = function (obj) {
				return Object.values(obj).filter(
					(value) => typeof value !== 'undefined'
				);
			};
			this.filters = filters;
			this.filteredCount = getCount(filters).length;
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
			const filters = this.filters;

			await this.emailService.getAll(['emailTemplate', 'user'],
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
					this.selectedEmail = this.emails ? this.emails[0] : null;
					const totalNoPage = Math.ceil(data.total / this.pageSize)

					if (this.threshholdHitCount >= totalNoPage) {
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
			await (
				this.employeesService.getAll(['user'], {
					organizationId,
					tenantId
				})
				.pipe(first())
				.toPromise())
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
		await this.emailService.update(this.selectedEmail.id, {
			isArchived: true
		})
		.then(() => {
			this.toastrService.success(
				this.getTranslation('SETTINGS.EMAIL_HISTORY.EMAIL_ARCHIVED')
			);
		})
		.finally(() => {
			this.emails$.next(true);
		});
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
		this.threshholdHitCount++;
		this.emails$.next(true);
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

	ngOnDestroy() {}
}
