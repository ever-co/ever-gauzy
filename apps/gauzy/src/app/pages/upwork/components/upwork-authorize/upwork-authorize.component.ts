import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { tap, switchMap, takeUntil, filter } from 'rxjs/operators';
import { EMPTY, Subject } from 'rxjs';
import { UpworkService } from 'apps/gauzy/src/app/@core/services/upwork.service';
import {
	PersistQuery,
	PersistStore,
	Store
} from 'apps/gauzy/src/app/@core/services/store.service';
import { IOrganization } from '@gauzy/models';

@Component({
	selector: 'ngx-upwork-authorize',
	templateUrl: './upwork-authorize.component.html',
	styleUrls: ['./upwork-authorize.component.scss']
})
export class UpworkAuthorizeComponent implements OnInit, OnDestroy {
	private _ngDestroy$: Subject<void> = new Subject();
	upworkConfigForm: FormGroup;
	rememberState: boolean;
	organization: IOrganization;

	constructor(
		private _fb: FormBuilder,
		private _upworkService: UpworkService,
		private _activatedRoute: ActivatedRoute,
		private _router: Router,
		private _storeService: Store,
		private _persistStore: PersistStore,
		private _persistQuery: PersistQuery
	) {}

	ngOnInit() {
		this._activatedRoute.data
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((data: any) => {
				if (data.hasOwnProperty('state')) {
					this.rememberState = data['state'];
					this._getUpworkVerifier();
				}
			});
		this._storeService.selectedOrganization$
			.pipe(
				filter((organization) => !!organization),
				takeUntil(this._ngDestroy$)
			)
			.subscribe((organization: IOrganization) => {
				this.organization = organization;
				this._persistStore.update({
					organizationId: this.organization.id
				});
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
				takeUntil(this._ngDestroy$)
			)
			.subscribe();
	}

	private _checkRemeberState() {
		this._upworkService
			.checkRemeberState()
			.pipe(
				tap((res) => {
					if (res.success) {
						const { record } = res;
						this._redirectToUpworkIntegration(record.id);
					}
				}),
				takeUntil(this._ngDestroy$)
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
				takeUntil(this._ngDestroy$)
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
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
