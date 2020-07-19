import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { UpworkService } from 'apps/gauzy/src/app/@core/services/upwork.service';
import { ActivatedRoute, Router } from '@angular/router';
import { tap, switchMap, takeUntil } from 'rxjs/operators';
import { EMPTY, Subject } from 'rxjs';

@Component({
	selector: 'ngx-upwork-authorize',
	templateUrl: './upwork-authorize.component.html',
	styleUrls: ['./upwork-authorize.component.scss']
})
export class UpworkAuthorizeComponent implements OnInit, OnDestroy {
	private _ngDestroy$: Subject<void> = new Subject();
	upworkConfigForm: FormGroup;

	constructor(
		private _fb: FormBuilder,
		private _upworkService: UpworkService,
		private _activatedRoute: ActivatedRoute,
		private _router: Router
	) {}

	ngOnInit() {
		this._getUpworkVerifier();
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
						return this._upworkService.getAccessToken({
							requestToken: params.oauth_token,
							verifier: params.oauth_verifier
						});
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

	authorizeUpwork(config) {
		this._upworkService
			.getAccessTokenSecretPair(config)
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
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
