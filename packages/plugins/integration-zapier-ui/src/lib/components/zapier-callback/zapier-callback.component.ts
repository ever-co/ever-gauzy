import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { tap, catchError, finalize } from 'rxjs/operators';
import { EMPTY } from 'rxjs';
import { ZapierService, ToastrService } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-zapier-callback',
	templateUrl: './zapier-callback.component.html',
	standalone: false
})
export class ZapierCallbackComponent extends TranslationBaseComponent implements OnInit {
	public loading = false;

	constructor(
		private readonly _route: ActivatedRoute,
		private readonly _router: Router,
		private readonly _zapierService: ZapierService,
		private readonly _toastrService: ToastrService,
		public readonly translateService: TranslateService
	) {
		super(translateService);
	}

	ngOnInit() {
		this._handleCallback();
	}

	private _handleCallback() {
		const { code } = this._route.snapshot.queryParams;
		if (!code) {
			this._toastrService.error(
				this.getTranslation('INTEGRATIONS.ZAPIER_PAGE.ERRORS.INVALID_CALLBACK'),
				this.getTranslation('TOASTR.TITLE.ERROR')
			);
			this._redirectToIntegrations();
			return;
		}

		this.loading = true;

		this._zapierService
			.exchangeCodeForToken({
				code,
				client_id: this._route.snapshot.queryParams.client_id,
				client_secret: this._route.snapshot.queryParams.client_secret,
				redirect_uri: this._route.snapshot.queryParams.redirect_uri,
				grant_type: 'authorization_code'
			})
			.pipe(
				tap(() => {
					this._toastrService.success(
						this.getTranslation('INTEGRATIONS.ZAPIER_PAGE.SUCCESS.AUTHORIZATION'),
						this.getTranslation('TOASTR.TITLE.SUCCESS')
					);
					this._redirectToIntegrations();
				}),
				catchError(() => {
					this._toastrService.error(
						this.getTranslation('INTEGRATIONS.ZAPIER_PAGE.ERRORS.AUTHORIZATION'),
						this.getTranslation('TOASTR.TITLE.ERROR')
					);
					this._redirectToIntegrations();
					return EMPTY;
				}),
				finalize(() => {
					this.loading = false;
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	private _redirectToIntegrations() {
		this._router.navigate(['/pages/integrations']);
	}
}
