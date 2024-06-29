import { Component, OnInit, OnDestroy } from '@angular/core';
import { UntypedFormGroup, UntypedFormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { EMPTY } from 'rxjs';
import { tap, switchMap, filter, debounceTime } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import {
	IAccessTokenSecretPair,
	IIntegrationTenant,
	IOrganization,
	IUpworkClientSecretPair,
	IntegrationEnum
} from '@gauzy/contracts';
import { Store } from '@gauzy/ui-core/common';
import { IntegrationsService, UpworkService } from '@gauzy/ui-core/core';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-upwork-authorize',
	templateUrl: './upwork-authorize.component.html',
	styleUrls: ['./upwork-authorize.component.scss']
})
export class UpworkAuthorizeComponent implements OnInit, OnDestroy {
	public rememberState: boolean;
	public organization: IOrganization;

	readonly form: UntypedFormGroup = UpworkAuthorizeComponent.buildForm(this._fb);
	static buildForm(fb: UntypedFormBuilder): UntypedFormGroup {
		return fb.group({
			consumerKey: [null, Validators.required],
			consumerSecret: [null, Validators.required]
		});
	}

	constructor(
		private readonly _fb: UntypedFormBuilder,
		private readonly _upworkService: UpworkService,
		private readonly _activatedRoute: ActivatedRoute,
		private readonly _router: Router,
		private readonly _store: Store,
		private readonly _integrationsService: IntegrationsService
	) {}

	ngOnInit() {
		this._store.selectedOrganization$
			.pipe(
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => (this.organization = organization)),
				untilDestroyed(this)
			)
			.subscribe();
		this._activatedRoute.data
			.pipe(
				debounceTime(100),
				filter(({ state }) => !!state),
				tap(({ state }) => (this.rememberState = state)),
				tap(() => this._getUpworkVerifier()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	private _getUpworkVerifier() {
		this._activatedRoute.queryParams
			.pipe(
				switchMap((params) => {
					if (params && params.oauth_verifier) {
						if (this.organization) {
							const { id: organizationId } = this.organization;
							const { oauth_token, oauth_verifier } = params;
							return this._upworkService.getAccessToken(
								{ requestToken: oauth_token, verifier: oauth_verifier },
								organizationId
							);
						}
					}
					// if remember state is true
					if (this.rememberState) {
						this._checkRememberState();
					}
					return EMPTY;
				}),
				tap((res) => this._redirectToUpworkIntegration(res.integrationId)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Upwork integration remember state API call
	 */
	private _checkRememberState() {
		if (!this.organization) {
			return;
		}
		const { id: organizationId, tenantId } = this.organization;
		const state$ = this._integrationsService.getIntegrationByOptions({
			name: IntegrationEnum.UPWORK,
			organizationId,
			tenantId
		});
		state$
			.pipe(
				filter((integration: IIntegrationTenant) => !!integration.id),
				tap((integration: IIntegrationTenant) => {
					this._redirectToUpworkIntegration(integration.id);
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 *
	 * @param config
	 * @returns
	 */
	authorizeUpwork(config: IUpworkClientSecretPair) {
		if (!this.organization || this.form.invalid) {
			return;
		}
		const { id: organizationId } = this.organization;
		const token$ = this._upworkService.getAccessTokenSecretPair(config, organizationId);
		token$
			.pipe(
				tap((token: IAccessTokenSecretPair) => {
					token.accessToken
						? this._redirectToUpworkIntegration(token.integrationId)
						: window.location.replace(token.url);
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 *
	 * @param integrationId
	 */
	private _redirectToUpworkIntegration(integrationId: string) {
		this._router.navigate(['pages/integrations/upwork', integrationId]);
	}

	ngOnDestroy(): void {}
}
