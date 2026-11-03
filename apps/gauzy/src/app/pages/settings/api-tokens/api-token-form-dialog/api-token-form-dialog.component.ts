/**
 * The "Create an API token" dialog: a name and an expiry. It closes with the input for the page to send, or with
 * nothing when it is cancelled.
 */
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { NbDialogRef } from '@nebular/theme';
import { IUserApiTokenCreateInput, UserApiTokenExpiryEnum } from '@gauzy/contracts';

@Component({
	selector: 'ngx-api-token-form-dialog',
	templateUrl: './api-token-form-dialog.component.html',
	styleUrls: ['./api-token-form-dialog.component.scss'],
	standalone: false,
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class ApiTokenFormDialogComponent {
	readonly expiries = [
		{ value: UserApiTokenExpiryEnum.DAYS_90, labelKey: 'USER_API_TOKENS.DIALOG.EXPIRY_90_DAYS' },
		{ value: UserApiTokenExpiryEnum.YEAR_1, labelKey: 'USER_API_TOKENS.DIALOG.EXPIRY_1_YEAR' },
		{ value: UserApiTokenExpiryEnum.NEVER, labelKey: 'USER_API_TOKENS.DIALOG.EXPIRY_NEVER' }
	];

	readonly form = new FormGroup({
		// Blanks alone are not a name: the API trims them away and would refuse what is left.
		name: new FormControl('', {
			nonNullable: true,
			validators: [Validators.required, Validators.maxLength(100), Validators.pattern(/\S/)]
		}),
		expiry: new FormControl(UserApiTokenExpiryEnum.DAYS_90, {
			nonNullable: true,
			validators: [Validators.required]
		})
	});

	private readonly dialogRef = inject<NbDialogRef<ApiTokenFormDialogComponent>>(NbDialogRef);

	save(): void {
		if (this.form.invalid) {
			this.form.markAllAsTouched();
			return;
		}
		const { name, expiry } = this.form.getRawValue();
		const input: IUserApiTokenCreateInput = { name: name.trim(), expiry };
		this.dialogRef.close(input);
	}

	cancel(): void {
		this.dialogRef.close();
	}
}
