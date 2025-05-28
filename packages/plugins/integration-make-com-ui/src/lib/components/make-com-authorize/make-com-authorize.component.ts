import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { tap, catchError } from 'rxjs/operators';
import { EMPTY } from 'rxjs';
import { MakeComService, ToastrService } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { TranslateService } from '@ngx-translate/core';
import { IMakeComCreateIntegration } from '@gauzy/contracts';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-make-com-authorize',
	templateUrl: './make-com-authorize.component.html',
	styleUrls: ['./make-com-authorize.component.scss'],
	standalone: false
})
export class AuthorizationComponent extends TranslationBaseComponent implements OnInit {
	public form: FormGroup;
	public loading = false;
	public oauthConfig: { clientId: string; redirectUri: string } = null;

	constructor(
		private readonly _fb: FormBuilder,
		private readonly _makeComService: MakeComService,
		private readonly _toastrService: ToastrService,
		public readonly translateService: TranslateService
	) {
		super(translateService);
	}

	ngOnInit() {
		this._initializeForm();
		this._loadOAuthConfig();
	}

	private _initializeForm() {
		this.form = this._fb.group({
			clientId: ['', [Validators.required]],
			clientSecret: ['', [Validators.required]]
		});
	}

	private _loadOAuthConfig() {
		this.loading = true;
		this._makeComService
			.getOAuthConfig()
			.pipe(
				tap((config) => {
					this.oauthConfig = config;
				}),
				catchError((error) => {
					this._toastrService.error(
						this.getTranslation('INTEGRATIONS.MAKE_PAGE.ERRORS.LOAD_OAUTH_CONFIG'),
						this.getTranslation('TOASTR.TITLE.ERROR')
					);
					console.error('Error loading OAuth config:', error);
					return EMPTY;
				}),
				untilDestroyed(this)
			)
			.subscribe(() => {
				this.loading = false;
			});
	}

	/**
	 * Start OAuth authorization flow
	 */
	startAuthorization() {
		if (this.form.invalid) {
			this._toastrService.error(
				this.getTranslation('INTEGRATIONS.MAKE_PAGE.ERRORS.INVALID_FORM'),
				this.getTranslation('TOASTR.TITLE.ERROR')
			);
			return;
		}

		this.loading = true;
		const credentials: IMakeComCreateIntegration = this.form.value;

		this._makeComService
			.addOAuthSettings(credentials)
			.pipe(
				tap((response) => {
					// Redirect to Make.com authorization page
					window.location.href = response.authorizationUrl;
				}),
				catchError((error) => {
					this._toastrService.error(
						this.getTranslation('INTEGRATIONS.MAKE_PAGE.ERRORS.START_AUTHORIZATION'),
						this.getTranslation('TOASTR.TITLE.ERROR')
					);
					console.error('Error starting authorization:', error);
					return EMPTY;
				}),
				untilDestroyed(this)
			)
			.subscribe(() => {
				this.loading = false;
			});
	}
}
