import { Component, OnInit, OnDestroy } from '@angular/core';
import { NbDialogService } from '@nebular/theme';
import { Subject } from 'rxjs';
import { EmailService } from '../../../@core/services/email.service';
import { Email } from '@gauzy/models';
import { DomSanitizer } from '@angular/platform-browser';
import { Store } from '../../../@core/services/store.service';
import { takeUntil } from 'rxjs/operators';

@Component({
	selector: 'ngx-email-history',
	templateUrl: './email-history.component.html',
	styleUrls: ['./email-history.component.scss']
})
export class EmailHistoryComponent implements OnInit, OnDestroy {
	private _onDestroy$ = new Subject<void>();

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
		private store: Store
	) {}

	ngOnInit() {
		this.store.selectedOrganization$
			.pipe(takeUntil(this._onDestroy$))
			.subscribe((org) => {
				if (org) {
					this._getAllEmails(org.id);
				}
			});
	}

	selectEmail(email: Email) {
		this.selectedEmail = email;
	}

	openFiltersDialog() {
		// this.dialogService.open(.....)
		console.log('Opening Filters Dialog');
	}

	private _getAllEmails(orgId: string) {
		try {
			this.emailService
				.getAll(['emailTemplate'], {
					orgId
				})
				.then((data) => {
					console.log(data);
					this.emails = data.items;
					this.loading = false;
				});
		} catch (error) {
			console.error(error);
			this.loading = false;
		}
	}

	ngOnDestroy() {
		this._onDestroy$.next();
		this._onDestroy$.complete();
	}
}
