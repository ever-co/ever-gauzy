import {
	Component,
	EventEmitter,
	Input,
	OnDestroy,
	OnInit,
	Output
} from '@angular/core';
import {
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
import { TranslateService } from '@ngx-translate/core';
import { MatchValidator } from '../../../@core/validators';
import { FormHelpers } from '../../../@shared/forms';
import { TranslationBaseComponent } from '../../../@shared/language-base';

@Component({
	selector: 'ga-accept-invite-form',
	templateUrl: 'accept-invite-form.component.html',
	styleUrls: ['accept-invite-form.component.scss']
})
export class AcceptInviteFormComponent
	extends TranslationBaseComponent
	implements OnInit, OnDestroy {

	FormHelpers: typeof FormHelpers = FormHelpers;

	@Input()
	invitation: IInvite;

	@Output()
	submitForm: EventEmitter<IUserRegistrationInput> = new EventEmitter<IUserRegistrationInput>();

	tenant: ITenant;
	tags: ITag[];

	public readonly form: FormGroup = AcceptInviteFormComponent.buildForm(this.fb);
	static buildForm(fb: FormBuilder): FormGroup {
		return fb.group({
			fullName: ['', Validators.required],
			password: ['', Validators.compose([
					Validators.required,
					Validators.minLength(4)
				])
			],
			repeatPassword: ['', Validators.required],
			agreeTerms: [false, Validators.requiredTrue]
		}, {
			validators: [
				MatchValidator.mustMatch(
					'password',
					'repeatPassword'
				)
			]
		});
	}

	constructor(
		private readonly fb: FormBuilder,
		public readonly translateService: TranslateService
	) {
		super(translateService);
	}

	ngOnInit(): void {}

	saveInvites() {
		if (this.form.valid) {
			const { fullName, password } = this.form.value;
			this.submitForm.emit({
				user: {
					firstName: fullName
						? fullName.split(' ').slice(0, -1).join(' ')
						: null,
					lastName: fullName
						? fullName.split(' ').slice(-1).join(' ')
						: null,
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
