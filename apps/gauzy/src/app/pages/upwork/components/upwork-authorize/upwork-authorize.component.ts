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
import { IOrganization } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import {
	Store,
	UpworkService
} from './../../../../@core/services';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-upwork-authorize',
	templateUrl: './upwork-authorize.component.html',
	styleUrls: ['./upwork-authorize.component.scss']
})
export class UpworkAuthorizeComponent implements OnInit, OnDestroy {
	rememberState: boolean;
	organization: IOrganization;

	readonly form: FormGroup = UpworkAuthorizeComponent.buildForm(this._fb);
	static buildForm(fb: FormBuilder): FormGroup {
		return fb.group({
			consumerKey: ['', Validators.required],
			consumerSecret: ['', Validators.required]
		});
	}

	constructor(
		private readonly _fb: FormBuilder,
		private readonly _upworkService: UpworkService,
		private readonly _activatedRoute: ActivatedRoute,
		private readonly _router: Router,
		private readonly _store: Store
	) {}

	ngOnInit() {
		this._store.selectedOrganization$
			.pipe(
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => this.organization = organization),
				untilDestroyed(this)
			)
			.subscribe();
		this._activatedRoute.data
			.pipe(
				debounceTime(100),
				filter(({ state }) => !!state),
				tap(({ state }) => this.rememberState = state),
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
							return this._upworkService.getAccessToken(
								{
									requestToken: params.oauth_token,
									verifier: params.oauth_verifier
								},
								organizationId
							);
						}
					}
					// if remember state is true
					if (this.rememberState) {
						this._checkRemeberState();
					}
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
		if (!this.organization) {
			return;
		}
		const { id: organizationId } = this.organization;
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
		if (!this.organization) {
			return;
		}
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

	ngOnDestroy(): void { }
}
