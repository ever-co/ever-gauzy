import { Component, OnInit, OnDestroy } from '@angular/core';
import { Validators, FormGroup, FormBuilder } from '@angular/forms';
import { filter, tap, takeUntil, switchMap } from 'rxjs/operators';
import { StepperEnum } from '../../stepper.enum';
import { ActivatedRoute } from '@angular/router';
import { Subject } from 'rxjs';
import { v4 as uuid } from 'uuid';
import { HubstaffService } from 'apps/gauzy/src/app/@core/services/hubstaff.service';

@Component({
	selector: 'ngx-hubstaff',
	templateUrl: './hubstaff.component.html',
	styleUrls: ['./hubstaff.component.scss']
})
export class HubstaffComponent implements OnInit, OnDestroy {
	private _ngDestroy$: Subject<void> = new Subject();
	authorizeForm: FormGroup;
	clientSecretForm: FormGroup;
	stepIndex: number;
	hubStaffAppCode: string;
	organizations: any[];
	settingsSmartTable: object;
	authorizationStepCompleted: boolean;
	clientSecretStepCompleted: boolean;

	constructor(
		private _activatedRoute: ActivatedRoute,
		private _hubstaffService: HubstaffService,
		private fb: FormBuilder
	) {}

	ngOnInit() {
		this._initializeForms();
		this._setCurrentStep();
		this._loadTableSettings();
	}

	private _loadTableSettings() {
		this.settingsSmartTable = {
			actions: false,
			columns: {
				id: {
					title: 'id',
					type: 'string',
					width: '20%',
					filter: false
				},
				name: {
					title: 'name',
					type: 'string',
					filter: false
				},
				status: {
					title: 'status',
					type: 'boolean',
					filter: false
				}
			}
		};
	}

	private _setCurrentStep() {
		const access_token = localStorage.getItem('hubstaff_access_token');

		if (access_token) {
			this._hubstaffService
				.getOrganizations(access_token)
				.pipe(takeUntil(this._ngDestroy$))
				.subscribe(({ organizations }) =>
					this._setOrganizations(organizations)
				);
			return;
		}
		this._getHubstaffCode();
	}

	private _initializeForms() {
		this.authorizeForm = this.fb.group({
			client_id: ['', Validators.required]
		});
		this.clientSecretForm = this.fb.group({
			client_secret: ['', Validators.required]
		});
	}

	private _getHubstaffCode() {
		this._activatedRoute.queryParams
			.pipe(
				tap(() => (this.stepIndex = StepperEnum.AUTHORIZE)),
				filter(({ code }) => code),
				tap(() => this._setSecondStep()),
				tap(({ code }) => (this.hubStaffAppCode = code)),
				takeUntil(this._ngDestroy$)
			)
			.subscribe();
	}

	private _setSecondStep() {
		this.stepIndex = StepperEnum.ACCESS_TOKEN;
		this.authorizationStepCompleted = true;
	}

	private _setThirdStep() {
		this.stepIndex = StepperEnum.SELECT_ORGANIZATION;
		this.authorizationStepCompleted = true;
		this.clientSecretStepCompleted = true;
	}

	authorizeHubstaff() {
		const { client_id } = this.authorizeForm.value;
		const redirect_uri =
			'http://localhost:4200/pages/integrations/hubstaff';
		// environment.HUBSTAFF_REDIRECT_URI;
		localStorage.setItem('client_id', client_id);
		const url = `https://account.hubstaff.com/authorizations/new?response_type=code&redirect_uri=${redirect_uri}&realm=hubstaff&client_id=${client_id}&scope=hubstaff:read&state=oauth2&nonce=${uuid()}`;

		window.location.replace(url);
	}

	genereteAccessTokens() {
		const client_id = localStorage.getItem('client_id');
		const getAccessTokensDto = {
			client_id,
			code: this.hubStaffAppCode,
			redirect_uri: 'http://localhost:4200/pages/integrations/hubstaff',
			client_secret: this.clientSecretForm.value.client_secret
		};

		this._hubstaffService
			.getAccessTokens(getAccessTokensDto)
			.pipe(
				tap((tokens) =>
					localStorage.setItem(
						'hubstaff_access_token',
						tokens.access_token
					)
				),
				switchMap((tokens) =>
					this._hubstaffService.getOrganizations(tokens.access_token)
				),
				takeUntil(this._ngDestroy$)
			)
			.subscribe(({ organizations }) =>
				this._setOrganizations(organizations)
			);
	}

	private _setOrganizations(organizations) {
		this._setThirdStep();
		this.organizations = organizations;
	}

	selectOrganization(organization) {
		console.log(organization);
	}

	ngOnDestroy() {
		localStorage.removeItem('client_id');
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
