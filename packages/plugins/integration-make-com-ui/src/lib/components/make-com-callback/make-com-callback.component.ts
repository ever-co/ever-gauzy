import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { tap, catchError } from 'rxjs/operators';
import { EMPTY } from 'rxjs';
import { MakeComService } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { TranslateService } from '@ngx-translate/core';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-make-com-callback',
	template: `
		<div class="d-flex justify-content-center align-items-center h-100">
			<span class="ml-2">{{ 'INTEGRATIONS.MAKE_COM_PAGE.PROCESSING' | translate }}</span>
		</div>
	`,
	standalone: false
})
export class MakeComCallbackComponent extends TranslationBaseComponent implements OnInit {
	constructor(
		private readonly _route: ActivatedRoute,
		private readonly _router: Router,
		private readonly _makeComService: MakeComService,
		public readonly translateService: TranslateService
	) {
		super(translateService);
	}

	ngOnInit() {
		this._route.queryParams
			.pipe(
				tap((params) => {
					if (params['code'] && params['state']) {
						this._handleCallback(params['code'], params['state']);
					} else {
						this._redirectToError();
					}
				}),
				catchError((error) => {
					console.error('Error processing Make.com callback:', error);
					this._redirectToError();
					return EMPTY;
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	private _handleCallback(code: string, state: string) {
		this._makeComService
			.handleTokenRequest({
				grant_type: 'authorization_code',
				code,
				state,
				client_id: '', // Will be handled by backend
				client_secret: '', // Will be handled by backend
				redirect_uri: '' // Will be handled by backend
			})
			.pipe(
				tap(() => {
					// Redirect to the main Make.com integration page
					this._router.navigate(['/pages/integrations/make-com']);
				}),
				catchError(() => {
					this._redirectToError();
					return EMPTY;
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	private _redirectToError() {
		this._router.navigate(['/pages/integrations'], {
			queryParams: {
				error: 'make-com-auth-failed'
			}
		});
	}
}
