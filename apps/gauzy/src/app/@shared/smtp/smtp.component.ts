import { AfterViewInit, Component, Input, OnChanges, OnInit, SimpleChanges, ViewChild } from '@angular/core';
import { UntypedFormBuilder, FormControl, UntypedFormGroup, FormGroupDirective, Validators } from '@angular/forms';
import { ActivatedRoute, Data } from '@angular/router';
import { ICustomSmtp, IOrganization, IUser, PermissionsEnum, SMTPSecureEnum } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { filter, pairwise, tap } from 'rxjs/operators';
import { Store } from '@gauzy/ui-sdk/common';
import { CustomSmtpService } from '@gauzy/ui-sdk/core';
import { TranslationBaseComponent } from '@gauzy/ui-sdk/i18n';
import { ToastrService } from '@gauzy/ui-sdk/core';
import { FormHelpers } from '../forms/helpers';
import { patterns } from '../regex/regex-patterns.const';

@UntilDestroy({ checkProperties: true })
@Component({
	templateUrl: './smtp.component.html',
	styleUrls: ['./smtp.component.scss']
})
export class SMTPComponent extends TranslationBaseComponent implements OnInit, OnChanges, AfterViewInit {
	@ViewChild('formDirective') formDirective: FormGroupDirective;

	@Input() organization?: IOrganization;
	@Input() isOrganization?: boolean;

	loading: boolean;
	secureOptions = [
		{ label: SMTPSecureEnum.TRUE, value: true },
		{ label: SMTPSecureEnum.FALSE, value: false }
	];
	customSmtp: ICustomSmtp;
	user: IUser;
	isValidated: boolean;
	isWrapped: boolean;

	PermissionsEnum: typeof PermissionsEnum = PermissionsEnum;
	FormHelpers: typeof FormHelpers = FormHelpers;

	/*
	 * SMTP Mutation Form
	 */
	public form: UntypedFormGroup = SMTPComponent.buildForm(this.fb);
	static buildForm(fb: UntypedFormBuilder): UntypedFormGroup {
		return fb.group({
			id: [],
			organizationId: [],
			fromAddress: [null, Validators.compose([Validators.required, Validators.pattern(patterns.email)])],
			host: [null, Validators.compose([Validators.required, Validators.pattern(patterns.host)])],
			port: [],
			secure: [],
			username: [null, Validators.required],
			password: [null, Validators.required],
			isValidate: [false]
		});
	}

	constructor(
		private readonly _activatedRoute: ActivatedRoute,
		private readonly fb: UntypedFormBuilder,
		private readonly customSmtpService: CustomSmtpService,
		public readonly translate: TranslateService,
		private readonly toastrService: ToastrService,
		private readonly store: Store
	) {
		super(translate);
	}

	ngOnInit(): void {
		this._activatedRoute.data
			.pipe(
				filter((data: Data) => !!data),
				tap(({ isOrganization }) => (this.isOrganization = isOrganization)),
				untilDestroyed(this)
			)
			.subscribe();
		this.store.user$
			.pipe(
				filter((user: IUser) => !!user),
				tap((user: IUser) => (this.user = user)),
				untilDestroyed(this)
			)
			.subscribe();
		this.store.selectedOrganization$
			.pipe(
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => (this.organization = organization)),
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
		const username = <FormControl>this.form.get('username');
		username.valueChanges.pipe(filter((val) => !!val)).subscribe((value) => {
			const substring = '****';
			this.isWrapped = value.includes(substring);
		});
		this.form.valueChanges.pipe(pairwise()).subscribe((values) => {
			const oldVal = values[0];
			const newVal = values[1];
			if ((newVal.username && oldVal.username) || (newVal.host && oldVal.host)) {
				if (newVal.username !== oldVal.username || newVal.host !== oldVal.host) {
					this.isValidated = false;
				}
			}
		});
	}

	/*
	 * Get tenant SMTP details
	 */
	getTenantSmtpSetting() {
		if (!this.user) {
			return;
		}
		const { tenantId } = this.user;

		this.loading = true;
		this.customSmtpService
			.getSMTPSetting({
				tenantId,
				...(this.organization && this.isOrganization
					? {
							organizationId: this.organization.id
					  }
					: {})
			})
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
				isValidate: this.customSmtp.isValidate,
				fromAddress: this.customSmtp.fromAddress
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
		if (this.form.invalid) {
			return;
		}
		this.customSmtpService
			.saveSMTPSetting({
				...this.form.getRawValue(),
				isValidate: this.isValidated
			})
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
		if (this.form.invalid) {
			return;
		}
		const { id } = this.form.getRawValue();
		this.customSmtpService
			.updateSMTPSetting(id, {
				...this.form.getRawValue(),
				isValidate: this.isValidated
			})
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

	/**
	 * Validate SMTP Credentials
	 */
	async validateSmtp() {
		try {
			const smtp = this.form.getRawValue();
			const validatedSmtp = await this.customSmtpService.validateSMTPSetting(smtp);

			if (typeof validatedSmtp === 'object') {
				this.isValidated = false;
				this.toastrService.error(validatedSmtp);
			} else {
				this.isValidated = true;
				this.toastrService.success(this.getTranslation('TOASTR.TITLE.SUCCESS'));
			}
		} catch (error) {
			this.isValidated = false;
			this.toastrService.error(this.getTranslation('TOASTR.MESSAGE.ERRORS'));
		}
	}
}
