import {
	Component,
	Input,
	OnChanges,
	OnInit,
	SimpleChanges,
	ViewChild
} from '@angular/core';
import {
	FormBuilder,
	FormGroup,
	FormGroupDirective,
	Validators
} from '@angular/forms';
import {
	ICustomSmtp,
	IOrganization,
	IUser,
	SMTPSecureEnum
} from '@gauzy/models';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { filter, tap } from 'rxjs/operators';
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
	implements OnInit, OnChanges {
	@Input() organization: IOrganization;
	@ViewChild('formDirective') formDirective: FormGroupDirective;

	form: FormGroup;
	loading: boolean;
	secureOptions = [
		{ label: SMTPSecureEnum.TRUE, value: true },
		{ label: SMTPSecureEnum.FALSE, value: false }
	];
	customSmtp: ICustomSmtp;
	user: IUser;

	constructor(
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
		this.store.user$
			.pipe(
				filter((user) => !!user),
				tap((user) => (this.user = user)),
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

	private _initializeForm() {
		this.form = this.fb.group({
			id: [''],
			organizationId: [''],
			host: ['', Validators.required],
			port: ['', Validators.required],
			secure: ['', Validators.required],
			username: ['', Validators.required],
			password: ['', Validators.required]
		});
	}

	/*
	 * Get tenant SMTP details
	 */
	getTenantSmtpSetting() {
		const { tenantId } = this.user;
		const find = { tenantId };
		if (this.organization) {
			find['organizationId'] = this.organization.id;
		}

		this.loading = true;
		this.customSmtpService
			.getSMTPSetting(find)
			.then((setting) => {
				this.customSmtp = setting;
				this.formDirective.resetForm();
				this.patchValue();
			})
			.finally(() => (this.loading = false));
	}

	/*
	 * Patch old SMTP details for tenant
	 */
	patchValue() {
		// if organization exist
		if (this.organization) {
			this.form.patchValue({
				organizationId: this.organization.id
			});
		}
		if (this.customSmtp) {
			this.form.patchValue({
				id: this.customSmtp.id,
				host: this.customSmtp.host,
				port: this.customSmtp.port,
				secure: this.customSmtp.secure,
				username: this.customSmtp.username,
				password: this.customSmtp.password
			});
		}
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
		delete value['id'];

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
		console.log(this.form);
	}
}
