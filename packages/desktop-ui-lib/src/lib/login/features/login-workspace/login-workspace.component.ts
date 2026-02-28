import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { NavigationExtras, Router, RouterLink } from '@angular/router';
import { HttpStatus, IAuthResponse, IUserSigninWorkspaceResponse, IWorkspaceResponse } from '@gauzy/contracts';
import { NbButtonModule, NbFormFieldModule, NbIconModule, NbInputModule } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslatePipe } from '@ngx-translate/core';
import { catchError, concatMap, EMPTY, filter, finalize, switchMap, tap } from 'rxjs';
import { AuthService, AuthStrategy } from '../../../auth';
import { SpinnerButtonDirective } from '../../../directives/spinner-button.directive';
import { ErrorHandlerService, Store } from '../../../services';
import { LogoComponent } from '../../shared/ui/logo/logo.component';
import { WorkspaceSelectionComponent } from '../../shared/ui/workspace-selection/workspace-selection.component';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-login-workspace',
	templateUrl: './login-workspace.component.html',
	styleUrls: ['./login-workspace.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		WorkspaceSelectionComponent,
		LogoComponent,
		NgTemplateOutlet,
		RouterLink,
		FormsModule,
		ReactiveFormsModule,
		NbInputModule,
		NbFormFieldModule,
		NbButtonModule,
		NbIconModule,
		SpinnerButtonDirective,
		TranslatePipe
	]
})
export class NgxLoginWorkspaceComponent implements OnInit {
	public confirmedEmail: string;
	public totalWorkspaces: number;
	public showPopup: boolean = false;
	public loading: boolean = false; // Flag to indicate if data loading is in progress
	public workspaces: IWorkspaceResponse[] = []; // Array of workspace users
	public showPassword = false;
	private state: NavigationExtras['state'];

	/** The FormGroup for the sign-in form */
	public form: FormGroup = NgxLoginWorkspaceComponent.buildForm(this._fb);

	/**
	 * Static method to build a FormGroup for the sign-in form.
	 *
	 * @param fb - The FormBuilder service for creating form controls.
	 * @returns A FormGroup for the sign-in form.
	 */
	static buildForm(fb: FormBuilder): FormGroup {
		return fb.group({
			email: new FormControl(null, [Validators.required, Validators.email]), // Email input with email validation
			password: new FormControl(null, [Validators.required]) // Password input with required validation
		});
	}

	constructor(
		private readonly _store: Store,
		private readonly _fb: FormBuilder,
		private readonly _authService: AuthService,
		private readonly _authStrategy: AuthStrategy,
		private readonly _errorHandlingService: ErrorHandlerService,
		private readonly cdr: ChangeDetectorRef,
		private readonly _router: Router
	) {
		const navigation = this._router.currentNavigation();
		this.state = navigation?.extras?.state;
	}

	ngOnInit(): void {
		this.handleWorkspaceNavigation();
	}

	/**
	 * Handle the form submission.
	 */
	onSubmit() {
		if (this.form.invalid) {
			return; // Exit if the form is invalid
		}

		//
		this.loading = true;

		// Get the values of email and password from the form
		const email = this.email.value;
		const password = this.password.value;

		// Send a request to sign in to workspaces using the authentication service
		this._authService
			.findWorkspaces({ email, password })
			.pipe(
				tap((response) => {
					if (response['status'] === HttpStatus.UNAUTHORIZED) {
						throw new Error(`${response['message']}`);
					}
				}),
				// Update component state with the fetched workspaces
				tap(({ workspaces, show_popup, total_workspaces, confirmed_email }: IUserSigninWorkspaceResponse) => {
					this.workspaces = workspaces;
					this.showPopup = show_popup;
					this.confirmedEmail = confirmed_email;
					this.totalWorkspaces = total_workspaces;
					/** */
					if (total_workspaces == 1) {
						const [workspace] = this.workspaces;
						this.signInWorkspace(workspace);
					}
				}),
				finalize(() => {
					this.loading = false;
					this.cdr.markForCheck();
				}),
				catchError((error) => {
					// Handle and log errors using the error handling service
					this.loading = false;
					this._errorHandlingService.handleError(error);
					return EMPTY;
				}),
				// Handle component lifecycle to avoid memory leaks
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Continue the workspace sign-in process.
	 */
	signInWorkspace(workspace: IWorkspaceResponse) {
		if (!workspace || !this.confirmedEmail) {
			return; // Exit if the no workspace
		}

		this.loading = true;

		// Extract workspace, email, and token from the parameter and component state
		const email = this.confirmedEmail;
		const token = workspace.token;

		// Send a request to sign in to the workspace using the authentication service
		this._authService
			.signinWorkspaceByToken({ email, token })
			.pipe(
				tap((response) => {
					if (response['status'] === HttpStatus.UNAUTHORIZED) {
						throw new Error(`${response['message']}`);
					}
				}),
				filter(({ user, token }: IAuthResponse) => !!user && !!token),
				switchMap((response: IAuthResponse) => {
					// Store authentication data using centralized method
					this._authStrategy.storeAuthenticationData(response);
					return this._authService.electronAuthentication(response);
				}),
				concatMap(() => this._router.navigate(['/time-tracker'])),
				finalize(() => {
					this.loading = false;
					this.cdr.markForCheck();
				}),
				catchError((error) => {
					// Handle and log errors using the error handling service
					this._errorHandlingService.handleError(error);
					this.loading = false;
					return EMPTY;
				}),
				// Handle component lifecycle to avoid memory leaks
				untilDestroyed(this)
			)
			.subscribe();
	}

	public get password() {
		return this.form.get('password');
	}

	public get email() {
		return this.form.get('email');
	}

	private handleWorkspaceNavigation(): void {
		if (this.state) {
			this.workspaces = this.state.workspaces;
			this.showPopup = this.state.show_popup;
			this.confirmedEmail = this.state.confirmed_email;
		}
	}
}
