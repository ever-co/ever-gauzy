/**
 * One-time reveal of a client's plaintext secret.
 *
 * Surfaced after `create` or `rotateSecret` — the backend returns the
 * plaintext `clientSecret` exactly once and then stores only the scrypt
 * hash. If the admin closes this dialog without copying, the secret is
 * gone and rotation is the only way to get a new one.
 */
import { ChangeDetectionStrategy, Component, Input, inject } from '@angular/core';
import { NbDialogRef, NbToastrService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { IOAuthClientWithSecret } from '@gauzy/contracts';

@Component({
	selector: 'ngx-oauth-client-secret-dialog',
	templateUrl: './oauth-client-secret-dialog.component.html',
	styleUrls: ['./oauth-client-secret-dialog.component.scss'],
	standalone: false,
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class OAuthClientSecretDialogComponent {
	// @Input retained (not signal `input()`) because Nebular's dialog
	// context binds the value via direct instance property assignment.
	@Input() client!: IOAuthClientWithSecret;
	acknowledged = false;

	private readonly dialogRef = inject<NbDialogRef<OAuthClientSecretDialogComponent>>(NbDialogRef);
	private readonly toastr = inject(NbToastrService);
	private readonly translate = inject(TranslateService);

	copyClientId(): void {
		this.copyToClipboard(this.client.clientId, 'OAUTH_CLIENTS.SECRET_DIALOG.COPIED_CLIENT_ID');
	}

	copySecret(): void {
		this.copyToClipboard(this.client.clientSecret, 'OAUTH_CLIENTS.SECRET_DIALOG.COPIED_SECRET');
	}

	close(): void {
		this.dialogRef.close();
	}

	private copyToClipboard(value: string, successKey: string): void {
		const notifySuccess = () =>
			this.toastr.success(
				this.translate.instant(successKey),
				this.translate.instant('TOASTR.TITLE.SUCCESS')
			);
		const notifyFailure = () =>
			this.toastr.danger(
				this.translate.instant('OAUTH_CLIENTS.ERRORS.COPY_FAILED'),
				this.translate.instant('TOASTR.TITLE.ERROR')
			);

		if (navigator?.clipboard?.writeText) {
			navigator.clipboard.writeText(value).then(notifySuccess).catch(() => {
				if (!this.legacyCopy(value)) {
					notifyFailure();
					return;
				}
				notifySuccess();
			});
			return;
		}

		// Fallback for browsers / contexts without the async Clipboard API
		// (e.g. insecure origins, older Safari). Surfaces a toast either way
		// so copy failures are never silent.
		if (this.legacyCopy(value)) {
			notifySuccess();
		} else {
			notifyFailure();
		}
	}

	private legacyCopy(value: string): boolean {
		try {
			const textarea = document.createElement('textarea');
			textarea.value = value;
			textarea.setAttribute('readonly', '');
			textarea.style.position = 'fixed';
			textarea.style.opacity = '0';
			document.body.appendChild(textarea);
			textarea.select();
			const ok = document.execCommand('copy');
			document.body.removeChild(textarea);
			return ok;
		} catch {
			return false;
		}
	}
}
