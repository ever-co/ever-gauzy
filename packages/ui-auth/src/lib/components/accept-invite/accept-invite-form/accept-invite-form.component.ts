import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { IInvite, ITermsAcceptanceDocument, IUserRegistrationInput, ITag, ITenant } from '@gauzy/contracts';
import { TranslateService } from '@ngx-translate/core';
import { AuthService, MatchValidator } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { FormHelpers } from '@gauzy/ui-core/shared';

@Component({
    selector: 'ga-accept-invite-form',
    templateUrl: './accept-invite-form.component.html',
    styleUrls: ['./accept-invite-form.component.scss'],
    standalone: false
})
export class AcceptInviteFormComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	FormHelpers: typeof FormHelpers = FormHelpers;

	@Input()
	invitation: IInvite;

	@Output()
	submitForm: EventEmitter<IUserRegistrationInput> = new EventEmitter<IUserRegistrationInput>();

	public tenant: ITenant;
	public tags: ITag[];

	/**
	 * The legal documents this invite acceptance must accept, as published by
	 * the API. Same shape and same purpose as on the signup form — see
	 * `NgxRegisterComponent`.
	 */
	public termsDocuments: ITermsAcceptanceDocument[] = [];

	/** True when the required documents could not be loaded. */
	public termsUnavailable: boolean = false;

	public readonly form: UntypedFormGroup = AcceptInviteFormComponent.buildForm(this.fb, this);
	static buildForm(fb: UntypedFormBuilder, self: AcceptInviteFormComponent): UntypedFormGroup {
		return fb.group(
			{
				fullName: [self?.invitation?.fullName, Validators.required],
				password: ['', Validators.compose([Validators.required, Validators.minLength(4)])],
				repeatPassword: ['', Validators.required],
				agreeTerms: [false, Validators.requiredTrue]
			},
			{
				validators: [MatchValidator.mustMatch('password', 'repeatPassword')]
			}
		);
	}

	constructor(
		private readonly fb: UntypedFormBuilder,
		private readonly authService: AuthService,
		public readonly translateService: TranslateService
	) {
		super(translateService);
	}

	ngOnInit(): void {
		if (this.form && this.invitation) {
			this.form.get('fullName').setValue(this.invitation.fullName);
			this.form.get('fullName').updateValueAndValidity();
		}

		// Load the documents this acceptance has to be pinned to. On failure the
		// submit button stays disabled: this form has always had a
		// `Validators.requiredTrue` terms checkbox whose value `saveInvites()`
		// then discarded, and completing a registration that records nothing is
		// exactly what is being fixed.
		this.authService.getRequiredTermsDocuments().subscribe({
			next: (documents: ITermsAcceptanceDocument[]) => {
				this.termsDocuments = documents ?? [];
				this.termsUnavailable = this.termsDocuments.length === 0;
			},
			error: () => {
				this.termsUnavailable = true;
			}
		});
	}

	saveInvites() {
		if (this.form.valid && !this.termsUnavailable) {
			const { fullName, password, agreeTerms } = this.form.value;

			// `agreeTerms` used to stop here — it gated the button and was then
			// dropped by this destructuring, so the acceptance was never
			// recorded. It now travels with the payload as the identity of the
			// exact text that was displayed: document id, version and sha256.
			// The API re-checks each claim against the published corpus.
			this.submitForm.emit({
				user: {
					firstName: fullName ? fullName.split(' ').slice(0, -1).join(' ') : null,
					lastName: fullName ? fullName.split(' ').slice(-1).join(' ') : null,
					email: this.invitation.email,
					role: this.invitation.role,
					tenant: this.tenant,
					tags: this.tags
				},
				password,
				terms: agreeTerms
					? this.termsDocuments.map(({ documentId, version, sha256, locale }) => ({
							documentId,
							version,
							sha256,
							locale
					  }))
					: undefined
			});
		}
	}

	ngOnDestroy(): void {}
}
