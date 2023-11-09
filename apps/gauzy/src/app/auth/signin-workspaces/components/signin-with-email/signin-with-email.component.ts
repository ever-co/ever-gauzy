import { Component, OnInit, ViewChild } from "@angular/core";
import { FormBuilder, FormGroup, Validators } from "@angular/forms";
import { EMPTY } from "rxjs";
import { catchError, tap } from "rxjs/operators";
import { IUser, IUserSigninWorkspaceResponse } from "@gauzy/contracts";
import { AuthService, ErrorHandlingService } from "./../../../../@core/services";
import { PasswordFormFieldComponent } from "./../../../../@shared/user/forms/fields/password";
import { UntilDestroy, untilDestroyed } from "@ngneat/until-destroy";

@UntilDestroy({ checkProperties: true })
@Component({
    selector: 'workspace-signin-with-email',
    templateUrl: './signin-with-email.component.html',
    styleUrls: ['./signin-with-email.component.scss'],
})
export class WorkspaceSigninWithEmailComponent implements OnInit {

    public confirmed_email: string;
    public total_workspaces: number;
    public show_popup: boolean = false;
    public loading: boolean = false; // Flag to indicate if data loading is in progress
    public workspaces: IUser[] = []; // Array of workspace users

    /** The FormGroup for the sign-in form */
    public form: FormGroup = WorkspaceSigninWithEmailComponent.buildForm(this._fb);

    /**
     * Static method to build a FormGroup for the sign-in form.
     *
     * @param fb - The FormBuilder service for creating form controls.
     * @returns A FormGroup for the sign-in form.
     */
    static buildForm(fb: FormBuilder): FormGroup {
        return fb.group({
            email: [null, [Validators.required, Validators.email]],      // Email input with email validation
            password: [null, Validators.required] // Password input with required validation
        });
    }

    /** */
    @ViewChild(PasswordFormFieldComponent, { static: true }) password: PasswordFormFieldComponent;

    constructor(
        private readonly _fb: FormBuilder,
        private readonly _authService: AuthService,
        private readonly _errorHandlingService: ErrorHandlingService,
    ) { }

    ngOnInit(): void { }

    /**
     * Handle the form submission.
     */
    onSubmit() {
        if (this.form.invalid) {
            return; // Exit if the form is invalid
        }

        try {
            // Get the values of email and password from the form
            const email = this.form.get('email').value;
            const password = this.form.get('password').value;

            // Send a request to sign in to workspaces using the authentication service
            this._authService.findWorkspaces({ email, password }).pipe(
                // Update component state with the fetched workspaces
                tap(({ workspaces, show_popup, total_workspaces, confirmed_email }: IUserSigninWorkspaceResponse) => {
                    this.workspaces = workspaces;
                    this.show_popup = show_popup;
                    this.total_workspaces = total_workspaces;
                    this.confirmed_email = confirmed_email;
                }),
                catchError((error) => {
                    // Handle and log errors using the error handling service
                    this._errorHandlingService.handleError(error);
                    return EMPTY;
                }),
                tap(() => this.loading = false), // Turn off loading indicator
                // Handle component lifecycle to avoid memory leaks
                untilDestroyed(this)
            ).subscribe();
        } catch (error) {
            console.log(error);
        }
    }
}
