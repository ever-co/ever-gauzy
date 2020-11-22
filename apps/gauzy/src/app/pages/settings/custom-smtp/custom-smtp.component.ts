import { Component, OnInit, ViewChild } from '@angular/core';
import {
	FormBuilder,
	FormGroup,
	FormGroupDirective,
	Validators
} from '@angular/forms';
import { ICustomSmtp, IUser, SMTPSecureEnum } from '@gauzy/models';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { filter, tap } from 'rxjs/operators';
import { CustomSmtpService } from '../../../@core/services/custom-smtp.service';
import { Store } from '../../../@core/services/store.service';
import { ToastrService } from '../../../@core/services/toastr.service';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-custom-smtp',
	templateUrl: './custom-smtp.component.html',
	styleUrls: ['./custom-smtp.component.css'],
	providers: [CustomSmtpService]
})
export class CustomSmtpComponent
	extends TranslationBaseComponent
	implements OnInit {
	@ViewChild('formDirective') formDirective: FormGroupDirective;
	form: FormGroup;

	secureOptions = [
		{ label: SMTPSecureEnum.TRUE, value: true },
		{ label: SMTPSecureEnum.FALSE, value: false }
	];
	customSmtp: ICustomSmtp;

	constructor(
		private readonly fb: FormBuilder,
		private readonly customSmtpService: CustomSmtpService,
		private readonly translate: TranslateService,
		private readonly toastrService: ToastrService,
		private readonly store: Store
	) {
		super(translate);
	}

	ngOnInit(): void {
		this._initializeForm();
		this.store.user$
			.pipe(
				untilDestroyed(this),
				filter((user) => !!user),
				tap((user) => this.getTenantSmtpSetting(user))
			)
			.subscribe();
	}

	private _initializeForm() {
		this.form = this.fb.group({
			id: [''],
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
	getTenantSmtpSetting(user: IUser) {
		const { tenantId } = user;
		this.customSmtpService.getSMTPSetting({ tenantId }).then((setting) => {
			this.customSmtp = setting;
			this.patchValue();
		});
	}

	/*
	 * Patch old SMTP details for tenant
	 */
	patchValue() {
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
		this.customSmtpService
			.saveSMTPSetting(this.form.value)
			.then(() => {
				this.toastrService.success(
					this.getTranslation('TOASTR.TITLE.SUCCESS'),
					this.getTranslation(`TOASTR.MESSAGE.CUSTOM_SMTP_ADDED`)
				);
			})
			.catch(() => {
				this.toastrService.error('TOASTR.MESSAGE.ERRORS');
			});
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
			});
	}
}
