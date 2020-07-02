import { Component, OnInit, OnDestroy } from '@angular/core';
import { Validators, FormGroup, FormBuilder } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { filter, tap, takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { HubstaffService } from 'apps/gauzy/src/app/@core/services/hubstaff.service';

@Component({
	selector: 'ngx-hubstaff-authorize',
	templateUrl: './hubstaff-authorize.component.html',
	styleUrls: ['./hubstaff-authorize.component.scss']
})
export class HubstaffAuthorizeComponent implements OnInit, OnDestroy {
	private _ngDestroy$: Subject<void> = new Subject();
	authorizeForm: FormGroup;
	clientSecretForm: FormGroup;
	hubStaffAppCode: string;

	constructor(
		private _activatedRoute: ActivatedRoute,
		private _hubstaffService: HubstaffService,
		private fb: FormBuilder,
		private _router: Router
	) {}

	ngOnInit() {
		this._initializeForms();
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
				filter(({ code }) => code),
				tap(({ code }) => (this.hubStaffAppCode = code)),
				takeUntil(this._ngDestroy$)
			)
			.subscribe();
	}

	authorizeHubstaff() {
		const { client_id } = this.authorizeForm.value;
		this._hubstaffService.authorizeClient(client_id);
	}

	addIntegration() {
		const { client_secret } = this.clientSecretForm.value;
		this._hubstaffService
			.addIntegration(this.hubStaffAppCode, client_secret)
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(({ id }) =>
				this._router.navigate(['pages/integrations/hubstaff', id])
			);
	}

	ngOnDestroy() {
		localStorage.removeItem('client_id');
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
