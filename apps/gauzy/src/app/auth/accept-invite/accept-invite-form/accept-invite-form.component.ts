import {
	Component,
	EventEmitter,
	Input,
	OnDestroy,
	OnInit,
	Output
} from '@angular/core';
import {
	AbstractControl,
	FormBuilder,
	FormGroup,
	Validators
} from '@angular/forms';
import {
	IInvite,
	IUserRegistrationInput,
	ITag,
	ITenant
} from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-accept-invite-form',
	templateUrl: 'accept-invite-form.component.html',
	styleUrls: ['accept-invite-form.component.scss']
})
export class AcceptInviteFormComponent
	extends TranslationBaseComponent
	implements OnInit, OnDestroy {

	@Input()
	invitation: IInvite;

	@Output()
	submitForm: EventEmitter<IUserRegistrationInput> = new EventEmitter<IUserRegistrationInput>();

	//Fields for the form
	form: FormGroup;
	fullName: AbstractControl;
	password: AbstractControl;
	repeatPassword: AbstractControl;
	agreeTerms: AbstractControl;
	tenant: ITenant;
	tags: ITag[];

	matchPassword: boolean;
	repeatPasswordErrorMsg: string;

	private validations = {
		passwordControl: () => {
			this.password.valueChanges
				.pipe(untilDestroyed(this))
				.subscribe(() => {
					if (this.password.value === this.repeatPassword.value) {
						this.matchPassword = true;
					} else {
						this.matchPassword = false;
					}
				});
		},
		repeatPasswordControl: () => {
			this.repeatPassword.valueChanges
				.pipe(untilDestroyed(this))
				.subscribe(() => {
					if (this.password.value === this.repeatPassword.value) {
						this.matchPassword = true;
					} else {
						this.matchPassword = false;
					}
					this.repeatPasswordErrorMsg =
						(this.repeatPassword.touched ||
							this.repeatPassword.dirty) &&
						this.repeatPassword.errors
							? this.repeatPassword.errors.validUrl
								? this.passwordDoNotMatch()
								: Object.keys(this.repeatPassword.errors)[0]
							: '';
				});
		}
	};

	constructor(
		private readonly fb: FormBuilder,
		readonly translateService: TranslateService
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this.loadFormData();
	}

	passwordDoNotMatch() {
		return this.getTranslation(
			'ACCEPT_INVITE.ACCEPT_INVITE_FORM.PASSWORDS_DO_NOT_MATCH'
		);
	}

	loadFormData = async () => {
		this.form = this.fb.group({
			fullName: ['', Validators.required],
			password: [
				'',
				Validators.compose([
					Validators.required,
					Validators.minLength(4)
				])
			],
			repeatPassword: [
				'',
				[
					(control: AbstractControl) => {
						if (this.password) {
							return control.value === this.password.value
								? null
								: { validUrl: true };
						} else {
							return null;
						}
					}
				]
			],
			agreeTerms: [false, Validators.requiredTrue]
		});

		this.fullName = this.form.get('fullName');
		this.password = this.form.get('password');
		this.repeatPassword = this.form.get('repeatPassword');
		this.agreeTerms = this.form.get('agreeTerms');

		this.loadControls();
	};

	loadControls() {
		this.validations.passwordControl();
		this.validations.repeatPasswordControl();
	}

	saveInvites() {
		if (this.form.valid) {
			this.submitForm.emit({
				user: {
					firstName: this.fullName.value
						? this.fullName.value.split(' ').slice(0, -1).join(' ')
						: null,
					lastName: this.fullName.value
						? this.fullName.value.split(' ').slice(-1).join(' ')
						: null,
					email: this.invitation.email,
					role: this.invitation.role,
					tenant: this.tenant,
					tags: this.tags
				},
				password: this.password.value
			});
		}
	}

	ngOnDestroy(): void {}
}
