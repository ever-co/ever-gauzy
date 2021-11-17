import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
	tap,
	switchMap,
	filter,
	debounceTime
} from 'rxjs/operators';
import { EMPTY } from 'rxjs';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import {
	PersistQuery,
	PersistStore,
	Store,
	UpworkService
} from './../../../../@core/services';
import { IOrganization } from '@gauzy/contracts';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-upwork-authorize',
	templateUrl: './upwork-authorize.component.html',
	styleUrls: ['./upwork-authorize.component.scss']
})
export class UpworkAuthorizeComponent implements OnInit, OnDestroy {
	upworkConfigForm: FormGroup;
	rememberState: boolean;
	organization: IOrganization;

	constructor(
		private readonly _fb: FormBuilder,
		private readonly _upworkService: UpworkService,
		private readonly _activatedRoute: ActivatedRoute,
		private readonly _router: Router,
		private readonly _storeService: Store,
		private readonly _persistStore: PersistStore,
		private readonly _persistQuery: PersistQuery
	) {}

	ngOnInit() {
		this._storeService.selectedOrganization$
			.pipe(
				filter((organization) => !!organization),
				untilDestroyed(this)
			)
			.subscribe((organization: IOrganization) => {
				this.organization = organization;
				this._persistStore.update({
					organizationId: this.organization.id
				});
			});
		this._activatedRoute.data
			.pipe(untilDestroyed(this), debounceTime(100))
			.subscribe((data: any) => {
				if (data.hasOwnProperty('state')) {
					this.rememberState = data['state'];
					this._getUpworkVerifier();
				}
			});
	}

	private _initializeForm() {
		this.upworkConfigForm = this._fb.group({
			consumerKey: ['', Validators.required],
			consumerSecret: ['', Validators.required]
		});
	}

	private _getUpworkVerifier() {
		this._activatedRoute.queryParams
			.pipe(
				switchMap((params) => {
					if (params && params.oauth_verifier) {
						const {
							organizationId
						} = this._persistQuery.getValue();
						return this._upworkService.getAccessToken(
							{
								requestToken: params.oauth_token,
								verifier: params.oauth_verifier
							},
							organizationId
						);
					}
					// if remember state is true
					if (this.rememberState) {
						this._checkRemeberState();
					}
					this._initializeForm();
					return EMPTY;
				}),
				tap((res) =>
					this._redirectToUpworkIntegration(res.integrationId)
				),
				untilDestroyed(this)
			)
			.subscribe();
	}

	private _checkRemeberState() {
		const { organizationId } = this._persistQuery.getValue();
		this._upworkService
			.checkRemeberState(organizationId)
			.pipe(
				tap((res) => {
					if (res.success) {
						const { record } = res;
						this._redirectToUpworkIntegration(record.id);
					}
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	authorizeUpwork(config) {
		const { id: organizationId } = this.organization;
		this._upworkService
			.getAccessTokenSecretPair(config, organizationId)
			.pipe(
				tap((res) => {
					res.accessToken
						? this._redirectToUpworkIntegration(res.integrationId)
						: window.location.replace(res.url);
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	private _redirectToUpworkIntegration(integrationId) {
		this._router.navigate(['pages/integrations/upwork', integrationId]);
	}

	ngOnDestroy(): void {
		this._persistStore.update({
			organizationId: null
		});
	}
}
