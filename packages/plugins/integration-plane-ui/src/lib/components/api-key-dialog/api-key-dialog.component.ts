import { Component, OnDestroy, signal, ChangeDetectionStrategy } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';

/** How long the "Copied!" confirmation stays visible before resetting. */
const COPIED_RESET_MS = 2000;

@Component({
	selector: 'ngx-plane-api-key-dialog',
	templateUrl: './api-key-dialog.component.html',
	styleUrls: ['./api-key-dialog.component.scss'],
	standalone: false,
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class PlaneApiKeyDialogComponent implements OnDestroy {
	apiKey = '';
	apiSecret = '';

	readonly apiKeyCopied = signal(false);
	readonly apiSecretCopied = signal(false);

	private _keyResetTimer?: ReturnType<typeof setTimeout>;
	private _secretResetTimer?: ReturnType<typeof setTimeout>;
	private _destroyed = false;

	constructor(private readonly dialogRef: NbDialogRef<PlaneApiKeyDialogComponent>) {}

	/**
	 * Copy value to clipboard and show a transient check mark.
	 */
	async copyToClipboard(value: string, field: 'key' | 'secret'): Promise<void> {
		try {
			await navigator.clipboard.writeText(value);
			this._markCopied(field);
		} catch {
			// Fallback for older browsers
			const textarea = document.createElement('textarea');
			textarea.value = value;
			textarea.style.position = 'fixed';
			textarea.style.opacity = '0';
			document.body.appendChild(textarea);
			textarea.select();
			const success = document.execCommand('copy');
			document.body.removeChild(textarea);
			if (success) {
				this._markCopied(field);
			}
		}
	}

	/**
	 * Flag the field as copied and auto-reset the flag shortly after, so a repeat
	 * copy re-confirms (instead of the check mark being stuck for the dialog's life).
	 */
	private _markCopied(field: 'key' | 'secret'): void {
		// A pending clipboard write can resolve after the dialog is torn down; don't
		// mutate a destroyed component or schedule a timer the cleanup won't catch.
		if (this._destroyed) return;
		if (field === 'key') {
			this.apiKeyCopied.set(true);
			clearTimeout(this._keyResetTimer);
			this._keyResetTimer = setTimeout(() => this.apiKeyCopied.set(false), COPIED_RESET_MS);
		} else {
			this.apiSecretCopied.set(true);
			clearTimeout(this._secretResetTimer);
			this._secretResetTimer = setTimeout(() => this.apiSecretCopied.set(false), COPIED_RESET_MS);
		}
	}

	close(): void {
		this.dialogRef.close();
	}

	ngOnDestroy(): void {
		this._destroyed = true;
		clearTimeout(this._keyResetTimer);
		clearTimeout(this._secretResetTimer);
	}
}
