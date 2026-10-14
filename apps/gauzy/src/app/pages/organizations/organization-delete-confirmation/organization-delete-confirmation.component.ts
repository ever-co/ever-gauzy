import { Component, ElementRef, AfterViewInit, ViewChild } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import { IOrganization } from '@gauzy/contracts';

/**
 * The confirmation an organization delete opens. Deleting an organization is a
 * hard delete, so a single "OK" is not enough: the dialog names the record,
 * says it cannot be undone, and keeps the destructive button disabled until the
 * organization's name is typed back exactly. It closes with `'ok'` on confirm,
 * like the shared `DeleteConfirmationComponent` it replaces on this page.
 */
@Component({
	selector: 'ga-organization-delete-confirmation',
	templateUrl: './organization-delete-confirmation.component.html',
	styleUrls: ['./organization-delete-confirmation.component.scss'],
	standalone: false
})
export class OrganizationDeleteConfirmationComponent implements AfterViewInit {
	organization: IOrganization;
	typedName = '';

	@ViewChild('nameInput') nameInput: ElementRef<HTMLInputElement>;

	constructor(protected readonly dialogRef: NbDialogRef<OrganizationDeleteConfirmationComponent>) {}

	get name(): string {
		return (this.organization?.name ?? '').trim();
	}

	/** The name wrapped for the `innerHTML` label, escaped so it renders as text. */
	get nameMarkup(): string {
		const escaped = this.name
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;');
		return `<strong class="confirm-name">${escaped}</strong>`;
	}

	get isConfirmed(): boolean {
		return !!this.name && this.typedName.trim() === this.name;
	}

	ngAfterViewInit() {
		// After the dialog's own focus handling, so the caret lands in the field.
		setTimeout(() => this.nameInput?.nativeElement.focus());
	}

	close() {
		this.dialogRef.close();
	}

	delete() {
		if (!this.isConfirmed) {
			return;
		}
		this.dialogRef.close('ok');
	}
}
