import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { IAuthResponse, IWorkspaceResponse } from '@gauzy/contracts';
import { AuthService, Store } from '@gauzy/ui-core/core';

/**
 * Accepts only a path inside the web app (one leading slash, no scheme, no backslash).
 *
 * @param redirect - A path the API validated when the sign-in started.
 * @returns The path, or `/`.
 */
export function safeAppPath(redirect: string | undefined): string {
	if (typeof redirect !== 'string' || !redirect.startsWith('/') || redirect.startsWith('//') || redirect.includes('\\')) {
		return '/';
	}
	return redirect;
}

/**
 * Finishes an Ever ID sign-in exactly as the e-mail code sign-in does: the workspace token goes to
 * the unchanged `POST /api/auth/signin.workspace`, and the session it returns is stored.
 */
@Injectable({ providedIn: 'root' })
export class EverIdSignInService {
	private readonly authService = inject(AuthService);
	private readonly store = inject(Store);
	private readonly router = inject(Router);

	/**
	 * Signs in to one workspace and opens the app.
	 *
	 * @param email - The `confirmed_email` of the workspace response.
	 * @param workspace - The chosen workspace.
	 * @param redirect - Optional path to open afterwards.
	 */
	signIn(email: string, workspace: IWorkspaceResponse, redirect?: string): Observable<IAuthResponse> {
		return this.authService.signinWorkspaceByToken({ email, token: workspace.token }).pipe(
			tap(({ user, token, refresh_token }: IAuthResponse) => {
				this.store.userId = user.id;
				this.store.user = user;
				this.store.token = token;
				this.store.refresh_token = refresh_token;
				this.store.organizationId = user.employee?.organizationId;
				this.store.tenantId = user.tenantId;
				this.router.navigateByUrl(safeAppPath(redirect));
			})
		);
	}
}
