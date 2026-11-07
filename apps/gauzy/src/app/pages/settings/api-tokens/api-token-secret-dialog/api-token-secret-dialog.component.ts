/**
 * One-time reveal of a new API token. The API returns the plain value this once and stores only its hash, so a user who
 * closes this without copying has to revoke the token and create another.
 */
import { ChangeDetectionStrategy, Component, Input, inject } from '@angular/core';
import { NbDialogRef, NbToastrService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { IUserApiTokenWithSecret } from '@gauzy/contracts';

@Component({
	selector: 'ngx-api-token-secret-dialog',
	templateUrl: './api-token-secret-dialog.component.html',
	styleUrls: ['./api-token-secret-dialog.component.scss'],
	standalone: false,
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class ApiTokenSecretDialogComponent {
	// @Input, not a signal `input()`: Nebular's dialog context binds the value by direct assignment.
	@Input() created!: IUserApiTokenWithSecret;
	acknowledged = false;

	private readonly dialogRef = inject<NbDialogRef<ApiTokenSecretDialogComponent>>(NbDialogRef);
	private readonly toastr = inject(NbToastrService);
	private readonly translate = inject(TranslateService);

	copyToken(): void {
		const notifySuccess = () =>
			this.toastr.success(
				this.translate.instant('USER_API_TOKENS.SECRET_DIALOG.COPIED'),
				this.translate.instant('TOASTR.TITLE.SUCCESS')
			);
		const notifyFailure = () =>
			this.toastr.danger(
				this.translate.instant('USER_API_TOKENS.ERRORS.COPY_FAILED'),
				this.translate.instant('TOASTR.TITLE.ERROR')
			);
		const value = this.created.token;

		if (navigator?.clipboard?.writeText) {
			navigator.clipboard
				.writeText(value)
				.then(notifySuccess)
				.catch(() => (this.legacyCopy(value) ? notifySuccess() : notifyFailure()));
			return;
		}

		// Browsers and contexts without the async Clipboard API (an insecure origin, an older Safari). A toast either way,
		// so that a failed copy is never silent: this is the only chance to get the value.
		if (this.legacyCopy(value)) {
			notifySuccess();
		} else {
			notifyFailure();
		}
	}

	close(): void {
		this.dialogRef.close();
	}

	private legacyCopy(value: string): boolean {
		let textarea: HTMLTextAreaElement | undefined;
		try {
			textarea = document.createElement('textarea');
			textarea.value = value;
			textarea.setAttribute('readonly', '');
			textarea.style.position = 'fixed';
			textarea.style.opacity = '0';
			document.body.appendChild(textarea);
			textarea.select();
			return document.execCommand('copy');
		} catch {
			return false;
		} finally {
			// Whatever happened, the plain token does not stay in the page.
			textarea?.remove();
		}
	}
}
