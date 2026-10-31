import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, firstValueFrom, map, Observable, of, shareReplay } from 'rxjs';
import { IRegistrationConfig } from '@gauzy/contracts';
import { API_PREFIX } from '@gauzy/ui-core/common';

/**
 * Whether a registration-config answer says the public sign-up is open.
 *
 * Only an explicit `enabled: false` reads as closed. A missing or malformed answer (an older API without the route)
 * reads as open, which keeps the Register links people have always seen; the API refuses a closed sign-up on its own,
 * so this only decides what the pages show.
 *
 * @param config The body of `GET /api/auth/registration/config`.
 * @returns False only for `{ enabled: false }`.
 */
export function isRegistrationOpen(config: Partial<IRegistrationConfig> | null | undefined): boolean {
	return config?.enabled !== false;
}

/**
 * Whether this server accepts new accounts through its public sign-up (`APP_USER_REGISTRATION`,
 * `ALLOW_TENANTS_REGISTRATION` on the API). Read by the sign-in pages to hide their Register links and by the register
 * route to send people to sign in instead.
 */
@Injectable({ providedIn: 'root' })
export class RegistrationConfigService {
	private readonly _http = inject(HttpClient);

	/**
	 * Asked once per page load and shared by every reader. A failed request reads as open (see
	 * {@link isRegistrationOpen}). Completes after its one value.
	 */
	readonly registrationEnabled$: Observable<boolean> = this._http
		.get<IRegistrationConfig>(`${API_PREFIX}/auth/registration/config`)
		.pipe(
			map((config) => isRegistrationOpen(config)),
			catchError(() => of(true)),
			shareReplay({ bufferSize: 1, refCount: false })
		);

	/**
	 * @returns Whether the public sign-up is open.
	 */
	isRegistrationEnabled(): Promise<boolean> {
		return firstValueFrom(this.registrationEnabled$);
	}
}
