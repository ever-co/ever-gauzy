import { Component, OnInit, OnDestroy } from '@angular/core';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { Subject } from 'rxjs';
import { EmailService } from '../../../@core/services/email.service';
import { IEmail, IOrganization } from '@gauzy/models';
import { DomSanitizer } from '@angular/platform-browser';
import { Store } from '../../../@core/services/store.service';
import { takeUntil, first } from 'rxjs/operators';
import { EmailFiltersComponent } from './email-filters/email-filters.component';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
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

	selectedEmail: IEmail;

	filteredCount: Number;

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
				.getAll(['emailTemplate', 'user'], {
					organizationId,
					tenantId,
					...filters
				})
				.then((data) => {
					this.emails = data.items;
					this.loading = false;

					this.selectedEmail = null;
				});
		} catch (error) {
			this.toastrService.danger(
				this.getTranslation('TOASTR.TITLE.ERROR')
			);
			console.error(error);
			this.loading = false;
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
