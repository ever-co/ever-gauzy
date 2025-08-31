import { Component, Input, Output, EventEmitter, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { UntypedFormGroup, AbstractControl } from '@angular/forms';

/**
 * Shared component for email and code input form.
 * Used across workspace-create, workspace-signin, and workspace-find components.
 */
@Component({
	selector: 'ga-email-code-form',
	templateUrl: './email-code-form.component.html',
	styleUrls: ['./email-code-form.component.scss'],
	standalone: false,
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmailCodeFormComponent implements OnInit {
	@Input({ required: true }) form!: UntypedFormGroup;
	@Input() isLoading = false;
	@Input() isCodeSent = false;
	@Input() isCodeResent = false;
	@Input() countdown = 0;
	@Input() submitButtonText = 'BUTTONS.CONTINUE';
	@Input() sendCodeButtonText = 'BUTTONS.SEND_CODE';
	@Input() showForgotEmailLink = false;
	@Input() forgotEmailLink = 'mailto:support@gauzy.co';
	@Input() showEditEmailButton = true;
	@Input() descriptionText = 'LOGIN_PAGE.LOGIN_MAGIC.DESCRIPTION_TITLE';
	@Input() successSentCodeTitle = 'LOGIN_PAGE.LOGIN_MAGIC.SUCCESS_SENT_CODE_TITLE';
	@Input() successSentCodeSubTitle = 'LOGIN_PAGE.LOGIN_MAGIC.SUCCESS_SENT_CODE_SUB_TITLE';

	@Output() readonly sendCode = new EventEmitter<void>();
	@Output() readonly resendCode = new EventEmitter<void>();
	@Output() readonly submitForm = new EventEmitter<void>();
	@Output() readonly editEmail = new EventEmitter<void>();

	ngOnInit(): void {
		if (!this.form) {
			throw new Error('Form is required for EmailCodeFormComponent');
		}
	}

	/**
	 * Getter for the email form control.
	 */
	get email(): AbstractControl | null {
		return this.form.get('email');
	}

	/**
	 * Getter for the code form control.
	 */
	get code(): AbstractControl | null {
		return this.form.get('code');
	}

	/**
	 * Handle send code button click
	 */
	onSendCode(): void {
		this.sendCode.emit();
	}

	/**
	 * Handle resend code link click
	 */
	onResendCode(): void {
		this.resendCode.emit();
	}

	/**
	 * Handle form submission
	 */
	onSubmit(): void {
		this.submitForm.emit();
	}

	/**
	 * Handle edit email button click
	 */
	onEditEmail(): void {
		this.editEmail.emit();
	}
}
