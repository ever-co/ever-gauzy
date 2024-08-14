import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { IInvite, IUserRegistrationInput, ITag, ITenant } from '@gauzy/contracts';
import { TranslateService } from '@ngx-translate/core';
import { MatchValidator } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { FormHelpers } from '@gauzy/ui-core/shared';

@Component({
	selector: 'ga-accept-invite-form',
	templateUrl: './accept-invite-form.component.html',
	styleUrls: ['./accept-invite-form.component.scss']
})
export class AcceptInviteFormComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	FormHelpers: typeof FormHelpers = FormHelpers;

	@Input()
	invitation: IInvite;

	@Output()
	submitForm: EventEmitter<IUserRegistrationInput> = new EventEmitter<IUserRegistrationInput>();

	public tenant: ITenant;
	public tags: ITag[];

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

	constructor(private readonly fb: UntypedFormBuilder, public readonly translateService: TranslateService) {
		super(translateService);
	}

	ngOnInit(): void {
		if (this.form && this.invitation) {
			this.form.get('fullName').setValue(this.invitation.fullName);
			this.form.get('fullName').updateValueAndValidity();
		}
	}

	saveInvites() {
		if (this.form.valid) {
			const { fullName, password } = this.form.value;
			this.submitForm.emit({
				user: {
					firstName: fullName ? fullName.split(' ').slice(0, -1).join(' ') : null,
					lastName: fullName ? fullName.split(' ').slice(-1).join(' ') : null,
					email: this.invitation.email,
					role: this.invitation.role,
					tenant: this.tenant,
					tags: this.tags
				},
				password
			});
		}
	}

	ngOnDestroy(): void {}
}
