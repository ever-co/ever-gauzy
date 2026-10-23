import { Component, ElementRef, AfterViewInit, ViewChild, inject } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import { IOrganization } from '@gauzy/contracts';

/**
 * The confirmation an organization delete opens. Deleting an organization is a
 * hard delete, so a single "OK" is not enough: the dialog names the record,
 * says it cannot be undone, and keeps the destructive button disabled until the
 * confirmation phrase is typed back exactly. It closes with `'ok'` on confirm,
 * like the shared `DeleteConfirmationComponent` it replaces on this page.
 */
@Component({
	selector: 'ga-organization-delete-confirmation',
	templateUrl: './organization-delete-confirmation.component.html',
	styleUrls: ['./organization-delete-confirmation.component.scss'],
	standalone: false
})
export class OrganizationDeleteConfirmationComponent implements AfterViewInit {
	/** Set through the dialog's `context`. */
	organization: IOrganization;

	protected typedName = '';

	@ViewChild('nameInput') readonly nameInput: ElementRef<HTMLInputElement>;

	private readonly dialogRef = inject<NbDialogRef<OrganizationDeleteConfirmationComponent>>(NbDialogRef);

	protected get name(): string {
		return (this.organization?.name ?? '').trim();
	}

	/**
	 * What has to be typed back: the organization's name or, for the records the
	 * create form let through with a blank (spaces-only) name, a fixed word — so
	 * those can still be deleted, but never from an empty field.
	 */
	protected get confirmationPhrase(): string {
		return this.name || 'DELETE';
	}

	protected get isConfirmed(): boolean {
		return this.typedName.trim() === this.confirmationPhrase;
	}

	ngAfterViewInit() {
		// After the dialog's own focus handling, so the caret lands in the field.
		setTimeout(() => this.nameInput?.nativeElement.focus());
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
