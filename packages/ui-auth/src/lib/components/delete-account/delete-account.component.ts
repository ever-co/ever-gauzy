import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Inject, OnDestroy } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { TranslateService } from '@ngx-translate/core';
import { LanguagesEnum } from '@gauzy/contracts';
import { AccountDeletionService } from './account-deletion.service';
import { useNoReferrer } from './referrer-policy';

/**
 * `/auth/delete-account`: ask for a link to delete your account(s), by email address only.
 *
 * Whatever the address, the page shows the same "check your inbox" message: the API answers the same way
 * whether or not the address has an account.
 */
@Component({
	selector: 'ngx-delete-account',
	templateUrl: './delete-account.component.html',
	styleUrls: ['./delete-account.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	standalone: false
})
export class NgxDeleteAccountComponent implements OnDestroy {
	email = '';
	submitting = false;
	sent = false;
	error: string | null = null;

	private readonly restoreReferrer: () => void;

	constructor(
		private readonly accountDeletionService: AccountDeletionService,
		private readonly translate: TranslateService,
		private readonly cdr: ChangeDetectorRef,
		@Inject(DOCUMENT) private readonly document: Document
	) {
		this.restoreReferrer = useNoReferrer(document);
	}

	async submit(): Promise<void> {
		if (this.submitting || !this.email) {
			return;
		}
		this.submitting = true;
		this.error = null;
		try {
			await this.accountDeletionService.request({
				email: this.email.trim(),
				callbackUrl: this.confirmPageUrl(),
				locale: (this.translate.getCurrentLang() as LanguagesEnum) || undefined
			});
			this.sent = true;
		} catch (error) {
			this.error =
				error instanceof HttpErrorResponse && error.status === 429
					? 'DELETE_ACCOUNT_PAGE.REQUEST.TOO_MANY'
					: 'DELETE_ACCOUNT_PAGE.REQUEST.FAILED';
		} finally {
			this.submitting = false;
			this.cdr.markForCheck();
		}
	}

	/** This app's own confirmation page (hash routing), which the emailed link opens. */
	private confirmPageUrl(): string {
		const { origin, pathname } = this.document.location;
		return `${origin}${pathname}#/auth/delete-account/confirm`;
	}

	ngOnDestroy(): void {
		this.restoreReferrer();
	}
}
