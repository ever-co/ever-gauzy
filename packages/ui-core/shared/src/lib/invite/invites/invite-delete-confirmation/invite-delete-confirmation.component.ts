import { Component, ElementRef, AfterViewInit, ViewChild, inject } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';

/**
 * The confirmation an invite delete opens. Deleting an invitation revokes its
 * link for good, so a single "OK" is not enough: the dialog names the invitee,
 * says it cannot be undone, and keeps the destructive button disabled until the
 * email is typed back exactly. It closes with `'ok'` on confirm, like the shared
 * `DeleteConfirmationComponent` it replaces on the invites page.
 */
@Component({
	selector: 'ga-invite-delete-confirmation',
	templateUrl: './invite-delete-confirmation.component.html',
	styleUrls: ['./invite-delete-confirmation.component.scss'],
	standalone: false
})
export class InviteDeleteConfirmationComponent implements AfterViewInit {
	/** Set through the dialog's `context`. */
	email: string;

	protected typedText = '';

	@ViewChild('confirmInput') readonly confirmInput: ElementRef<HTMLInputElement>;

	private readonly dialogRef = inject<NbDialogRef<InviteDeleteConfirmationComponent>>(NbDialogRef);

	/**
	 * What has to be typed back: the invitee's email or, should an invite ever
	 * come through without one, a fixed word — never an empty field.
	 */
	protected get confirmationPhrase(): string {
		return (this.email ?? '').trim() || 'DELETE';
	}

	/** Emails are case-insensitive, so the match is too. */
	protected get isConfirmed(): boolean {
		return this.typedText.trim().toLowerCase() === this.confirmationPhrase.toLowerCase();
	}

	ngAfterViewInit() {
		// After the dialog's own focus handling, so the caret lands in the field.
		setTimeout(() => this.confirmInput?.nativeElement.focus());
	}

	protected close() {
		this.dialogRef.close();
	}

	protected delete() {
		if (!this.isConfirmed) {
			return;
		}
		this.dialogRef.close('ok');
	}
}
