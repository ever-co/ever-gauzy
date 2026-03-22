import { Component, signal, ChangeDetectionStrategy } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';

@Component({
	selector: 'ngx-plane-api-key-dialog',
	templateUrl: './api-key-dialog.component.html',
	styleUrls: ['./api-key-dialog.component.scss'],
	standalone: false,
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class PlaneApiKeyDialogComponent {
	apiKey: string;
	apiSecret: string;

	readonly apiKeyCopied = signal(false);
	readonly apiSecretCopied = signal(false);

	constructor(private readonly dialogRef: NbDialogRef<PlaneApiKeyDialogComponent>) {}

	/**
	 * Copy value to clipboard and show check mark.
	 */
	async copyToClipboard(value: string, field: 'key' | 'secret'): Promise<void> {
		try {
			await navigator.clipboard.writeText(value);
			if (field === 'key') {
				this.apiKeyCopied.set(true);
			} else {
				this.apiSecretCopied.set(true);
			}
		} catch {
			// Fallback for older browsers
			const textarea = document.createElement('textarea');
			textarea.value = value;
			textarea.style.position = 'fixed';
			textarea.style.opacity = '0';
			document.body.appendChild(textarea);
			textarea.select();
			document.execCommand('copy');
			document.body.removeChild(textarea);
			if (field === 'key') {
				this.apiKeyCopied.set(true);
			} else {
				this.apiSecretCopied.set(true);
			}
		}
	}

	close(): void {
		this.dialogRef.close();
	}
}
