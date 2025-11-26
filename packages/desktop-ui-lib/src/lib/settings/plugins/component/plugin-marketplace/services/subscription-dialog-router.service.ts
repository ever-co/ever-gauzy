import { Injectable } from '@angular/core';
import { IPlugin } from '@gauzy/contracts';
import { Observable, of } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class SubscriptionDialogRouterService {
	/**
	 * Open the appropriate subscription dialog for a plugin.
	 * This is a lightweight stub used during the refactor to satisfy
	 * type-checking and basic flows. It returns a default response.
	 */
	public openSubscriptionDialog(plugin: IPlugin): Observable<{ proceedWithInstallation: boolean }> {
		// Default: do not proceed with installation
		return of({ proceedWithInstallation: false });
	}
}
