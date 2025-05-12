import { Component, OnInit, OnDestroy } from '@angular/core';
import { UntypedFormGroup, UntypedFormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { EMPTY } from 'rxjs';
import { tap, switchMap, filter, debounceTime } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import {
	IIntegrationTenant,
	IOrganization,
	IntegrationEnum
} from '@gauzy/contracts';
import { IntegrationsService, Store, MakeComService } from '@gauzy/ui-core/core';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-make-com-authorize',
	templateUrl: './authorization.component.html',
	styleUrls: ['./authorization.component.scss']
})
export class AuthorizationComponent implements OnInit, OnDestroy {
	public rememberState: boolean = false;
	public organization: IOrganization | null = null;

	readonly form: UntypedFormGroup = AuthorizationComponent.buildForm(this._fb);
	static buildForm(fb: UntypedFormBuilder): UntypedFormGroup {
		return fb.group({
			clientId: [null, Validators.required],
			clientSecret: [null, Validators.required]
		});
	}

	constructor(
		private readonly _fb: UntypedFormBuilder,
		private readonly _makeComService: MakeComService,
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
				tap(() => this._getMakeComVerifier()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	private _getMakeComVerifier() {
		this._activatedRoute.queryParams
			.pipe(
				switchMap((params) => {
					if (params && params['code']) {
						if (this.organization) {
							const { id: organizationId } = this.organization;
							const { code, state } = params;
							return this._makeComService.exchangeCodeForToken(code, state, organizationId);
						}
					}
					// if remember state is true
					if (this.rememberState) {
						this._checkRememberState();
					}
					return EMPTY;
				}),
				tap((res: { integrationId: string }) => this._redirectToMakeComIntegration(res.integrationId)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Make.com integration remember state API call
	 */
	private _checkRememberState() {
		if (!this.organization) {
			return;
		}
		const { id: organizationId, tenantId } = this.organization;
		const state$ = this._integrationsService.getIntegrationByOptions({
			name: IntegrationEnum.MakeCom,
			organizationId,
			tenantId
		});
		state$
			.pipe(
				filter((integration: IIntegrationTenant) => !!integration.id),
				tap((integration: IIntegrationTenant) => {
					if (integration.id) {
						this._redirectToMakeComIntegration(integration.id);
					}
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Authorize Make.com integration
	 * @param config
	 */
	authorizeMakeCom(config: { clientId: string; clientSecret: string }) {
		if (!this.organization || this.form.invalid) {
			return;
		}
		const { id: organizationId } = this.organization;
		const token$ = this._makeComService.saveOAuthCredentials(config, organizationId);
		token$
			.pipe(
				tap((token: { integrationId: string; url: string }) => {
					if (token.integrationId) {
						this._redirectToMakeComIntegration(token.integrationId);
					} else if (token.url) {
						window.location.replace(token.url);
					}
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Redirect to Make.com integration page
	 * @param integrationId
	 */
	private _redirectToMakeComIntegration(integrationId: string) {
		this._router.navigate(['pages/integrations/make-com', integrationId]);
	}

	ngOnDestroy(): void {}
}
