import { Component, OnInit, OnDestroy } from '@angular/core';
import { Validators, UntypedFormGroup, UntypedFormBuilder } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { filter, tap } from 'rxjs/operators';
import { IIntegration, IIntegrationTenant, IOrganization, IntegrationEnum } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Store } from '@gauzy/ui-sdk/common';
import { HubstaffService } from '@gauzy/ui-sdk/core';
import { IntegrationsService } from './../../../../@core/services';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-hubstaff-authorize',
	templateUrl: './hubstaff-authorize.component.html',
	styleUrls: ['./hubstaff-authorize.component.scss']
})
export class HubstaffAuthorizeComponent implements OnInit, OnDestroy {
	public hubStaffAuthorizeCode: string;
	public organization: IOrganization;

	/** */
	public clientIdForm: UntypedFormGroup = HubstaffAuthorizeComponent.buildClientIdForm(this._fb);
	static buildClientIdForm(fb: UntypedFormBuilder): UntypedFormGroup {
		return fb.group({
			client_id: ['', Validators.required]
		});
	}

	/** */
	public clientSecretForm: UntypedFormGroup = HubstaffAuthorizeComponent.buildClientSecretForm(this._fb);
	static buildClientSecretForm(fb: UntypedFormBuilder): UntypedFormGroup {
		return fb.group({
			client_secret: ['', Validators.required],
			authorization_code: ['', Validators.required]
		});
	}

	constructor(
		private readonly _activatedRoute: ActivatedRoute,
		private readonly _hubstaffService: HubstaffService,
		private readonly _fb: UntypedFormBuilder,
		private readonly _router: Router,
		private readonly _store: Store,
		private readonly _integrationsService: IntegrationsService
	) {}

	ngOnInit() {
		this._store.selectedOrganization$
			.pipe(
				filter((organization) => !!organization),
				tap((organization: IOrganization) => (this.organization = organization)),
				untilDestroyed(this)
			)
			.subscribe();
		this._getHubstaffCode();
	}

	private _getHubstaffCode() {
		this._activatedRoute.queryParams
			.pipe(
				filter(({ code }) => code),
				tap(({ code }) => (this.hubStaffAuthorizeCode = code)),
				tap(({ code, state }) => {
					this.clientIdForm.patchValue({ client_id: state });
					this.clientSecretForm.patchValue({
						authorization_code: code
					});
				}),
				untilDestroyed(this)
			)
			.subscribe();

		if (!this.hubStaffAuthorizeCode) {
			this.subscribeRouteData();
		}
	}

	private subscribeRouteData() {
		this._activatedRoute.data
			.pipe(
				// if remember state is true
				filter(({ state }) => !!state && state === true),
				tap(() => this._checkRememberState()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Hubstaff integration remember state API call
	 */
	private _checkRememberState() {
		if (!this.organization) {
			return;
		}
		const { id: organizationId, tenantId } = this.organization;
		const state$ = this._integrationsService.getIntegrationByOptions({
			name: IntegrationEnum.HUBSTAFF,
			organizationId,
			tenantId
		});
		state$
			.pipe(
				filter((integration: IIntegrationTenant) => !!integration.id),
				tap((integration: IIntegrationTenant) => {
					this._redirectToHubstaffIntegration(integration.id);
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Hubstaff integration remember state API call
	 */
	private _redirectToHubstaffIntegration(integrationId: IIntegration['id']) {
		this._router.navigate(['pages/integrations/hubstaff', integrationId]);
	}

	authorizeHubstaff() {
		const { client_id } = this.clientIdForm.value;
		this._hubstaffService.authorizeClient(client_id);
	}

	addIntegration() {
		if (!this.organization) {
			return;
		}

		const { client_secret } = this.clientSecretForm.value;
		const { client_id } = this.clientIdForm.value;
		const { id: organizationId } = this.organization;

		this._hubstaffService
			.addIntegration({
				code: this.hubStaffAuthorizeCode,
				client_secret,
				client_id,
				organizationId
			})
			.pipe(
				tap(({ id }) => {
					this._redirectToHubstaffIntegration(id);
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngOnDestroy() {}
}
