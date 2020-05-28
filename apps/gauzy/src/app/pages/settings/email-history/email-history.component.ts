import { Component, OnInit, OnDestroy } from '@angular/core';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { Subject } from 'rxjs';
import { EmailService } from '../../../@core/services/email.service';
import { Email, Organization } from '@gauzy/models';
import { DomSanitizer } from '@angular/platform-browser';
import { Store } from '../../../@core/services/store.service';
import { takeUntil, first } from 'rxjs/operators';
import { EmailFiltersComponent } from './email-filters/email-filters.component';

@Component({
	selector: 'ngx-email-history',
	templateUrl: './email-history.component.html',
	styleUrls: ['./email-history.component.scss']
})
export class EmailHistoryComponent implements OnInit, OnDestroy {
	private _onDestroy$ = new Subject<void>();

	private _selectedOrganization: Organization;

	loading = true;

	emails: Email[];
	selectedEmail: Email;

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
		private toastrService: NbToastrService
	) {}

	ngOnInit() {
		this.store.selectedOrganization$
			.pipe(takeUntil(this._onDestroy$))
			.subscribe((org) => {
				if (org) {
					this._selectedOrganization = org;
					// TODO: Here reset all filters!
					this._getSelectedOrganizationEmails(org.id);
				}
			});
	}

	selectEmail(email: Email) {
		this.selectedEmail = email;
	}

	async openFiltersDialog() {
		const filters = await this.dialogService
			.open(EmailFiltersComponent, {
				context: {}
			})
			.onClose.pipe(first())
			.toPromise();

		if (filters) {
			debugger;
			this._getSelectedOrganizationEmails(
				this._selectedOrganization.id,
				filters
			);
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

	private _getSelectedOrganizationEmails(
		organizationId: string,
		filters?: any
	) {
		try {
			this.emailService
				.getAll(['emailTemplate', 'user'], {
					organizationId,
					...filters
				})
				.then((data) => {
					console.log(data);
					this.emails = data.items;
					this.loading = false;

					this.selectedEmail = null;
				});
		} catch (error) {
			// TODO: toastr
			console.error(error);
			this.loading = false;
		}
	}

	ngOnDestroy() {
		this._onDestroy$.next();
		this._onDestroy$.complete();
	}
}
