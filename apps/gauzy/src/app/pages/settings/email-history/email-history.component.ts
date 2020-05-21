import { Component, OnInit, OnDestroy } from '@angular/core';
import { NbDialogService } from '@nebular/theme';
import { Subject } from 'rxjs';
import { EmailService } from '../../../@core/services/email.service';
import { Email } from '@gauzy/models';
import { DomSanitizer } from '@angular/platform-browser';

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
		private sanitizer: DomSanitizer
	) {}

	ngOnInit() {
		this._getAllEmails();
	}

	selectEmail(email: Email) {
		this.selectedEmail = email;
	}

	openFiltersDialog() {
		// this.dialogService.open(.....)
		console.log('Opening Filters Dialog');
	}

	private _getAllEmails() {
		try {
			this.emailService.getAll().then((data) => {
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
