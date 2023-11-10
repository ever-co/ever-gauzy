import { ChangeDetectionStrategy, Component, Input, OnInit } from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
import { EMPTY, filter } from "rxjs";
import { catchError, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { HttpStatus, IAuthResponse, IUser } from '@gauzy/contracts';
import { TranslationBaseComponent } from './../../../../@shared/language-base';
import { AuthService, ErrorHandlingService, Store } from './../../../../@core/services';
import { Router } from '@angular/router';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-multi-workspace-onboarding',
	templateUrl: './multi-workspace.component.html',
	styleUrls: ['./multi-workspace.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class MultiWorkspaceOnboardingComponent extends TranslationBaseComponent implements OnInit {

	public control = new FormControl(null, Validators.required);

	/**
	 *
	 */
	_workspaces: IUser[] = [];
	get workspaces(): IUser[] {
		return this._workspaces;
	}
	@Input() set workspaces(value: IUser[]) {
		this._workspaces = value;
	}

	/**
	 *
	 */
	_confirmed_email: string;
	get confirmed_email(): string {
		return this._confirmed_email;
	}
	@Input() set confirmed_email(value: string) {
		this._confirmed_email = value;
	}

	constructor(
		private readonly router: Router,
		public readonly translateService: TranslateService,
		private readonly _store: Store,
		private readonly _authService: AuthService,
		private readonly _errorHandlingService: ErrorHandlingService,
	) {
		super(translateService);
	}

	ngOnInit() { }

	/**
	 * Continue the workspace sign-in process.
	 */
	continue(workspace: any) {
		if (!workspace) {
			return; // Exit if the no workspace
		}

		// Extract workspace, email, and token from the parameter and component state
		const email = this.confirmed_email;
		const token = workspace.token;

		// Send a request to sign in to the workspace using the authentication service
		this._authService.signinWorkspaceByToken({ email, token }).pipe(
			tap((response: any) => {
				if (response['status'] === HttpStatus.UNAUTHORIZED) {
					throw new Error(`${response['message']}`);
				}
			}),
			catchError((error) => {
				// Handle and log errors using the error handling service
				this._errorHandlingService.handleError(error);
				return EMPTY;
			}),
			//
			filter(({ user, token }: IAuthResponse) => !!user && !!token),
			//
			tap((response: IAuthResponse) => {
				const user: IUser = response.user;
				const token: string = response.token;
				const refresh_token: string = response.refresh_token;

				/** */
				this._store.userId = user.id;
				this._store.user = user;
				this._store.token = token;
				this._store.refresh_token = refresh_token;
				this._store.organizationId = user.employee?.organizationId;
				this._store.tenantId = user.tenantId;

				this.router.navigate(['/']);
			}),
			// Handle component lifecycle to avoid memory leaks
			untilDestroyed(this)
		).subscribe();
	}
}
