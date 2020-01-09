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
	CreateEmailInvitesOutput,
	Invite,
	UserRegistrationInput
} from '@gauzy/models';
import { InviteService } from 'apps/gauzy/src/app/@core/services/invite.service';
import { RoleService } from 'apps/gauzy/src/app/@core/services/role.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
	selector: 'ga-accept-invite-form',
	templateUrl: 'accept-invite-form.component.html',
	styleUrls: ['accept-invite-form.component.scss']
})
export class AcceptInviteFormComponent implements OnInit, OnDestroy {
	private ngDestroy$ = new Subject<void>();

	@Input()
	invitation: Invite;

	@Output()
	submitForm: EventEmitter<UserRegistrationInput> = new EventEmitter<
		UserRegistrationInput
	>();

	//Fields for the form
	form: FormGroup;
	fullName: AbstractControl;
	password: AbstractControl;
	repeatPassword: AbstractControl;
	agreeTerms: AbstractControl;

	matchPassword: boolean;
	repeatPasswordErrorMsg: string;

	private validations = {
		passwordControl: () => {
			this.password.valueChanges
				.pipe(takeUntil(this.ngDestroy$))
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
				.pipe(takeUntil(this.ngDestroy$))
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
		private readonly inviteService: InviteService,
		private readonly roleService: RoleService
	) {}

	ngOnInit(): void {
		this.loadFormData();
	}

	passwordDoNotMatch() {
		return 'Password Do Not Match!';
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
						? this.fullName.value
								.split(' ')
								.slice(0, -1)
								.join(' ')
						: null,
					lastName: this.fullName.value
						? this.fullName.value
								.split(' ')
								.slice(-1)
								.join(' ')
						: null,
					email: this.invitation.email,
					role: this.invitation.role
				},
				password: this.password.value
			});
		}
	}

	ngOnDestroy(): void {
		this.ngDestroy$.next();
		this.ngDestroy$.complete();
	}
}
