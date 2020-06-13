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
	Invite,
	IOrganizationClientRegistrationInput,
	ITenant,
	OrganizationCreateInput,
	Tag
} from '@gauzy/models';
import { NbDialogService } from '@nebular/theme';
import { Subject } from 'rxjs';
import { first, takeUntil } from 'rxjs/operators';
import { OrganizationsMutationComponent } from '../../../@shared/organizations/organizations-mutation/organizations-mutation.component';

@Component({
	selector: 'ga-accept-client-invite-form',
	templateUrl: 'accept-client-invite-form.component.html',
	styleUrls: ['accept-client-invite-form.component.scss']
})
export class AcceptClientInviteFormComponent implements OnInit, OnDestroy {
	private ngDestroy$ = new Subject<void>();

	@Input()
	invitation: Invite;

	@Output()
	submitForm = new EventEmitter<IOrganizationClientRegistrationInput>();

	//Fields for the form
	form: FormGroup;
	fullName: AbstractControl;
	password: AbstractControl;
	repeatPassword: AbstractControl;
	agreeTerms: AbstractControl;
	tenant: ITenant;
	tags: Tag[];

	organizationCreateInput: OrganizationCreateInput;

	matchPassword: boolean;
	addedOrganization: boolean;
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
					this.matchPassword =
						this.password.value === this.repeatPassword.value;

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
		private readonly dialogService: NbDialogService
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

	async addClientOrganization() {
		this.organizationCreateInput = await this.dialogService
			.open(OrganizationsMutationComponent)
			.onClose.pipe(first())
			.toPromise();
		this.addedOrganization = !!this.organizationCreateInput;
	}

	createClient() {
		if (this.form.valid && this.addedOrganization) {
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
				password: this.password.value,
				clientOrganization: this.organizationCreateInput
			});
		}
	}

	ngOnDestroy(): void {
		this.ngDestroy$.next();
		this.ngDestroy$.complete();
	}
}
