import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { tap, catchError } from 'rxjs/operators';
import { EMPTY } from 'rxjs';
import { MakeComService, ToastrService } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { TranslateService } from '@ngx-translate/core';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-make-com-callback',
	templateUrl: './make-com-callback.component.html',
	standalone: false
})
export class MakeComCallbackComponent extends TranslationBaseComponent implements OnInit {
	public loading = false;

	constructor(
		private readonly _route: ActivatedRoute,
		private readonly _router: Router,
		private readonly _makeComService: MakeComService,
		private readonly _toastrService: ToastrService,
		public readonly translateService: TranslateService
	) {
		super(translateService);
	}

	ngOnInit() {
		this._handleCallback();
	}

	private _handleCallback() {
		this.loading = true;
		const { code, state } = this._route.snapshot.queryParams;

		if (!code || !state) {
			this._toastrService.error(
				this.getTranslation('INTEGRATIONS.MAKE_PAGE.ERRORS.INVALID_CALLBACK'),
				this.getTranslation('TOASTR.TITLE.ERROR')
			);
			this._redirectToIntegrations();
			return;
		}

		this._makeComService
			.handleTokenRequest({
				grant_type: 'authorization_code',
				code,
				state,
				client_id: '', // Will be handled by backend
				client_secret: '',
				redirect_uri: '' // Will be handled by backend
			})
			.pipe(
				tap(() => {
					this._toastrService.success(
						this.getTranslation('INTEGRATIONS.MAKE_PAGE.SUCCESS.AUTHORIZATION_COMPLETE'),
						this.getTranslation('TOASTR.TITLE.SUCCESS')
					);
					this._redirectToIntegrations();
				}),
				catchError((error) => {
					this._toastrService.error(
						this.getTranslation('INTEGRATIONS.MAKE_PAGE.ERRORS.AUTHORIZATION_FAILED'),
						this.getTranslation('TOASTR.TITLE.ERROR')
					);
					console.error('Error handling OAuth callback:', error);
					this._redirectToIntegrations();
					return EMPTY;
				}),
				untilDestroyed(this)
			)
			.subscribe(() => {
				this.loading = false;
			});
	}

	private _redirectToIntegrations() {
		this._router.navigate(['/pages/integrations']);
	}
}
