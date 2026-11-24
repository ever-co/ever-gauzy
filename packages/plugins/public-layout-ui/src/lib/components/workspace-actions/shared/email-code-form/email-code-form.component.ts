import {
	ChangeDetectionStrategy,
	ChangeDetectorRef,
	Component,
	DestroyRef,
	ElementRef,
	EventEmitter,
	Input,
	OnChanges,
	OnInit,
	Output,
	QueryList,
	type SimpleChanges,
	ViewChildren,
	inject
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { UntypedFormGroup, AbstractControl } from '@angular/forms';
import { ALPHA_NUMERIC_CODE_LENGTH } from '@gauzy/constants';
import { suggestEmailCorrection, webInboxUrl } from './email-hints';

/**
 * Shared component for email and code input form.
 * Used across workspace-create, workspace-signin, and workspace-find components.
 *
 * The code is typed into one box per character. The boxes are only a view on
 * the form's `code` control: every change is joined and written back to it, so
 * the parent's validation and submit logic are unchanged.
 */
@Component({
	selector: 'ga-email-code-form',
	templateUrl: './email-code-form.component.html',
	styleUrls: ['./email-code-form.component.scss'],
	standalone: false,
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmailCodeFormComponent implements OnInit, OnChanges {
	private readonly _cdr = inject(ChangeDetectorRef);
	private readonly _destroyRef = inject(DestroyRef);

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
	@Input() descriptionText = 'WORKSPACES.FIND.DESCRIPTION_TITLE';
	@Input() successSentCodeTitle = 'WORKSPACES.CREATE.SUCCESS_SENT_CODE_TITLE';
	@Input() successSentCodeSubTitle = 'WORKSPACES.CREATE.SUCCESS_SENT_CODE_SUB_TITLE';

	@Output() readonly sendCode = new EventEmitter<void>();
	@Output() readonly resendCode = new EventEmitter<void>();
	@Output() readonly submitForm = new EventEmitter<void>();
	@Output() readonly editEmail = new EventEmitter<void>();

	@ViewChildren('codeBox') private readonly _codeBoxes!: QueryList<ElementRef<HTMLInputElement>>;

	public readonly codeLength = ALPHA_NUMERIC_CODE_LENGTH;

	/** One entry per code box; '' for an empty box. */
	public codeChars: string[] = this._emptyCode();

	/** Corrected address offered under the email field, if the domain looks mistyped. */
	public emailSuggestion: string | null = null;

	/** Web inbox of the address's provider, offered once the code is sent. */
	public inboxUrl: string | null = null;

	/** The last complete code submitted automatically, so it is not sent twice. */
	private _autoSubmittedCode: string | null = null;

	ngOnInit(): void {
		if (!this.form) {
			throw new Error('Form is required for EmailCodeFormComponent');
		}

		this._updateEmailHints(this.email?.value);
		this.email?.valueChanges.pipe(takeUntilDestroyed(this._destroyRef)).subscribe((value) => {
			this._updateEmailHints(value);
			this._cdr.markForCheck();
		});

		// Follow outside changes to the control (a reset when the email is edited).
		this._syncCodeFromControl(this.code?.value);
		this.code?.valueChanges.pipe(takeUntilDestroyed(this._destroyRef)).subscribe((value) => {
			if ((value || '') !== this.codeChars.join('')) {
				this._syncCodeFromControl(value);
				this._cdr.markForCheck();
			}
		});
	}

	ngOnChanges(changes: SimpleChanges): void {
		if (changes['isCodeSent']?.currentValue && !changes['isCodeSent'].previousValue) {
			this._autoSubmittedCode = null;
			// Boxes render in this change detection pass; focus the first one after it.
			setTimeout(() => this._focusBox(0));
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
	 * Enter in any field submits the form: before the code is sent that means
	 * "send the code", afterwards "continue with this code".
	 */
	onSubmit(): void {
		if (!this.isCodeSent) {
			if (this.email?.valid && !this.isLoading) {
				this.onSendCode();
			}
			return;
		}
		this.submitForm.emit();
	}

	/**
	 * Handle edit email button click
	 */
	onEditEmail(): void {
		this.editEmail.emit();
	}

	/** Replace the typed address with the suggested correction. */
	applyEmailSuggestion(): void {
		if (!this.emailSuggestion || !this.email) {
			return;
		}
		this.email.setValue(this.emailSuggestion);
		this.email.markAsDirty();
		this.email.markAsTouched();
	}

	/** A character typed (or a whole code autofilled) into box `index`. */
	onCodeInput(index: number, event: Event): void {
		const input = event.target as HTMLInputElement;
		if (this.isLoading) {
			// The boxes are read-only while a code is checked; undo anything that got through.
			input.value = this.codeChars[index] ?? '';
			return;
		}
		let typed = this._sanitize(input.value);

		// A character typed into a box that still holds one (the caret sat beside
		// it rather than over it): keep the new character, not the old one.
		const previous = this.codeChars[index];
		if (typed.length === 2 && previous && typed.includes(previous)) {
			typed = typed[0] === previous ? typed[1] : typed[0];
		}

		if (typed.length > 1) {
			// A full code (autofill) starts at the first box; anything shorter
			// continues from the box it was typed into.
			this._fillFrom(typed.length >= this.codeLength ? 0 : index, typed);
		} else {
			this.codeChars[index] = typed;
			input.value = typed;
			if (typed) {
				this._focusBox(index + 1);
			}
		}
		this._commitCode();
	}

	/** Backspace walks back over empty boxes; arrows move between boxes. */
	onCodeKeydown(index: number, event: KeyboardEvent): void {
		switch (event.key) {
			case 'Backspace':
				// No edits while a code is being checked (arrows still move focus).
				if (this.isLoading) {
					event.preventDefault();
					break;
				}
				if (!this.codeChars[index] && index > 0) {
					event.preventDefault();
					this.codeChars[index - 1] = '';
					this._syncBoxes();
					this._focusBox(index - 1);
					this._commitCode();
				}
				break;
			case 'ArrowLeft':
				event.preventDefault();
				this._focusBox(index - 1);
				break;
			case 'ArrowRight':
				event.preventDefault();
				this._focusBox(index + 1);
				break;
		}
	}

	/** A pasted code fills the boxes, wherever it is pasted. */
	onCodePaste(index: number, event: ClipboardEvent): void {
		// Paste still fires on read-only inputs: while a code is being checked,
		// changing the boxes would show one code while the server checks another.
		if (this.isLoading) {
			event.preventDefault();
			return;
		}
		const text = this._sanitize(event.clipboardData?.getData('text') || '');
		if (!text) {
			return;
		}
		event.preventDefault();
		this._fillFrom(text.length >= this.codeLength ? 0 : index, text);
		this._commitCode();
	}

	/** Select the box's character so typing replaces it. */
	onCodeFocus(event: FocusEvent): void {
		(event.target as HTMLInputElement).select();
	}

	/** Show validation once focus leaves the whole group of boxes. */
	onCodeBlur(event: FocusEvent): void {
		const next = event.relatedTarget as HTMLElement | null;
		if (!next?.classList.contains('code-box')) {
			this.code?.markAsTouched();
		}
	}

	private _fillFrom(start: number, text: string): void {
		let position = start;
		for (const char of text) {
			if (position >= this.codeLength) {
				break;
			}
			this.codeChars[position++] = char;
		}
		this._syncBoxes();
		const firstEmpty = this.codeChars.indexOf('');
		this._focusBox(firstEmpty === -1 ? this.codeLength - 1 : firstEmpty);
	}

	/** Write the boxes back to the form control and continue once complete. */
	private _commitCode(): void {
		const value = this.codeChars.join('');
		this.code?.setValue(value);
		this.code?.markAsDirty();

		const complete = value.length === this.codeLength;
		if (complete && this.form.valid && !this.isLoading && value !== this._autoSubmittedCode) {
			this._autoSubmittedCode = value;
			this.submitForm.emit();
		}
	}

	private _syncCodeFromControl(value: string | null | undefined): void {
		const chars = this._sanitize(value || '').slice(0, this.codeLength).split('');
		this.codeChars = this._emptyCode().map((_, i) => chars[i] ?? '');
		if (!chars.length) {
			this._autoSubmittedCode = null;
		}
	}

	/** Keep each box's DOM value equal to its entry (a property binding skips unchanged values). */
	private _syncBoxes(): void {
		this._codeBoxes?.forEach((box, i) => (box.nativeElement.value = this.codeChars[i] ?? ''));
	}

	/**
	 * Focus a box and select its character, so the next keystroke replaces it.
	 * Selecting here too (not only on `focus`) matters when focus stays in the
	 * same box — the last one after a full entry — where no focus event fires.
	 */
	private _focusBox(index: number): void {
		const clamped = Math.max(0, Math.min(index, this.codeLength - 1));
		const box = this._codeBoxes?.get(clamped)?.nativeElement;
		box?.focus();
		box?.select();
	}

	private _updateEmailHints(value: string | null | undefined): void {
		// `errors`, not `valid`: a disabled control is never "valid", and the
		// email may be disabled while the code step is shown.
		const wellFormed = !!value && !this.email?.errors;
		this.emailSuggestion = wellFormed ? suggestEmailCorrection(value) : null;
		this.inboxUrl = wellFormed ? webInboxUrl(value) : null;
	}

	/** Codes are upper-case letters and digits; drop anything else. */
	private _sanitize(value: string): string {
		return value.toUpperCase().replace(/[^A-Z0-9]/g, '');
	}

	private _emptyCode(): string[] {
		return Array.from({ length: ALPHA_NUMERIC_CODE_LENGTH }, () => '');
	}
}
