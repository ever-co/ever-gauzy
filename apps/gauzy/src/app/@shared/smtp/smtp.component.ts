import {
	AfterViewInit,
	Component,
	Input,
	OnChanges,
	OnInit,
	SimpleChanges,
	ViewChild
} from '@angular/core';
import {
	FormBuilder,
	FormControl,
	FormGroup,
	FormGroupDirective,
	Validators
} from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import {
	ICustomSmtp,
	IOrganization,
	IUser,
	SMTPSecureEnum
} from '@gauzy/models';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { debounceTime, filter, pairwise, tap } from 'rxjs/operators';
import { CustomSmtpService } from '../../@core/services/custom-smtp.service';
import { Store } from '../../@core/services/store.service';
import { ToastrService } from '../../@core/services/toastr.service';
import { TranslationBaseComponent } from '../language-base/translation-base.component';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-smtp',
	templateUrl: './smtp.component.html',
	styleUrls: ['./smtp.component.scss']
})
export class SMTPComponent
	extends TranslationBaseComponent
	implements OnInit, OnChanges, AfterViewInit {
	@ViewChild('formDirective') formDirective: FormGroupDirective;

	@Input() organization?: IOrganization;
	@Input() isOrganization?: boolean;

	form: FormGroup;
	loading: boolean;
	secureOptions = [
		{ label: SMTPSecureEnum.TRUE, value: true },
		{ label: SMTPSecureEnum.FALSE, value: false }
	];
	customSmtp: ICustomSmtp;
	user: IUser;
	hostPattern =
		'^(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]).)*([A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9-]*[A-Za-z0-9])$';
	isValidated: boolean;

	constructor(
		private readonly _activatedRoute: ActivatedRoute,
		private readonly fb: FormBuilder,
		private readonly customSmtpService: CustomSmtpService,
		readonly translate: TranslateService,
		private readonly toastrService: ToastrService,
		private readonly store: Store
	) {
		super(translate);
	}

	ngOnInit(): void {
		this._initializeForm();
		this._activatedRoute.data
			.pipe(
				tap(
					({ isOrganization }) =>
						(this.isOrganization = isOrganization)
				),
				untilDestroyed(this)
			)
			.subscribe();
		this.store.user$
			.pipe(
				filter((user) => !!user),
				tap((user) => (this.user = user)),
				untilDestroyed(this)
			)
			.subscribe();
		this.store.selectedOrganization$
			.pipe(
				filter((organization) => !!organization),
				tap((organization) => (this.organization = organization)),
				tap(() => this.getTenantSmtpSetting()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngOnChanges(change: SimpleChanges) {
		if (change.organization.previousValue) {
			this.getTenantSmtpSetting();
		}
	}

	ngAfterViewInit() {
		const control1 = <FormControl>this.form.get('username');
		const control2 = <FormControl>this.form.get('password');
		control1.valueChanges.subscribe((value) => {
			if (value) {
				control2.setValidators([Validators.required]);
			} else {
				control2.setValidators(null);
			}
			control2.updateValueAndValidity();
		});

		this.form.valueChanges.pipe(pairwise()).subscribe((values) => {
			const oldVal = values[0];
			const newVal = values[1];
			if (
				(newVal.username && oldVal.username) ||
				(newVal.host && oldVal.host)
			) {
				if (
					newVal.username !== oldVal.username ||
					newVal.host !== oldVal.host
				) {
					this.isValidated = false;
				}
			}
		});
	}

	private _initializeForm() {
		this.form = this.fb.group({
			id: [''],
			organizationId: [''],
			host: [
				'',
				Validators.compose([
					Validators.required,
					Validators.pattern(this.hostPattern)
				])
			],
			port: [''],
			secure: [''],
			username: [''],
			password: [''],
			isValidate: [false]
		});
	}

	/*
	 * Get tenant SMTP details
	 */
	getTenantSmtpSetting() {
		const { tenantId } = this.user;
		const find = { tenantId };

		if (this.organization && this.isOrganization) {
			find['organizationId'] = this.organization.id;
		}

		this.loading = true;
		this.customSmtpService
			.getSMTPSetting(find)
			.then((setting) => {
				this.formDirective.resetForm();
				if (setting && setting.hasOwnProperty('auth')) {
					this.globalSmtpPatch(setting);
				} else {
					this.customSmtp = setting;
					this.patchValue();
				}
				// if organization exist
				if (this.organization && this.isOrganization) {
					this.form.patchValue({
						organizationId: this.organization.id
					});
				}
			})
			.finally(() => (this.loading = false));
	}

	/*
	 * Patch old SMTP details for tenant
	 */
	patchValue() {
		if (this.customSmtp) {
			this.isValidated = this.customSmtp.isValidate ? true : false;
			this.form.patchValue({
				id: this.customSmtp.id,
				host: this.customSmtp.host,
				port: this.customSmtp.port,
				secure: this.customSmtp.secure,
				username: this.customSmtp.username,
				password: this.customSmtp.password,
				isValidate: this.customSmtp.isValidate
			});
		}
	}

	/*
	 * Global SMTP Configuration
	 */
	globalSmtpPatch(setting: any) {
		this.form.patchValue({
			host: setting.host,
			port: setting.port,
			secure: setting.secure,
			username: setting['auth']['user'],
			password: setting['auth']['pass']
		});
	}

	onSubmit() {
		if (this.form.invalid) {
			return;
		}

		if (this.form.get('id').value) {
			this.updateSetting();
		} else {
			this.saveSetting();
		}
	}

	saveSetting() {
		const { value } = this.form;
		value['isValidate'] = this.isValidated;

		this.customSmtpService
			.saveSMTPSetting(value)
			.then(() => {
				this.toastrService.success(
					this.getTranslation('TOASTR.TITLE.SUCCESS'),
					this.getTranslation(`TOASTR.MESSAGE.CUSTOM_SMTP_ADDED`)
				);
			})
			.catch(() => {
				this.toastrService.error('TOASTR.MESSAGE.ERRORS');
			})
			.finally(() => this.getTenantSmtpSetting());
	}

	updateSetting() {
		const { id } = this.form.value;
		const { value } = this.form;
		value['isValidate'] = this.isValidated;

		this.customSmtpService
			.updateSMTPSetting(id, value)
			.then(() => {
				this.toastrService.success(
					this.getTranslation('TOASTR.TITLE.SUCCESS'),
					this.getTranslation(`TOASTR.MESSAGE.CUSTOM_SMTP_UPDATED`)
				);
			})
			.catch(() => {
				this.toastrService.error('TOASTR.MESSAGE.ERRORS');
			})
			.finally(() => this.getTenantSmtpSetting());
	}

	validateSmtp() {
		const { value } = this.form;
		this.customSmtpService
			.validateSMTPSetting(value)
			.then(() => {
				this.isValidated = true;
				this.toastrService.success(
					this.getTranslation('TOASTR.TITLE.SUCCESS')
				);
			})
			.catch(() => {
				this.isValidated = false;
				this.toastrService.error(
					this.getTranslation('TOASTR.MESSAGE.ERRORS')
				);
			});
	}
}
