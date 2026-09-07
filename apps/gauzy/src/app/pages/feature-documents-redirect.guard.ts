import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router, UrlTree } from '@angular/router';
import { FeatureEnum } from '@gauzy/contracts';
import { Store } from '@gauzy/ui-core/core';

/**
 * Legacy → Documents-hub redirect (gate, never delete — 09-consolidation-migration.md §3.2).
 *
 * Applied to the legacy `/pages/organization/documents` and
 * `/pages/organization/help-center` routes. While `FEATURE_DOCUMENTS` is off it
 * activates the legacy page exactly as today; once the flag is on it returns a
 * `UrlTree` to `/pages/documents` so the legacy lazy module is never loaded (no
 * flash of the old page). The legacy quick-add deep link `?openAddDialog=true`
 * maps to the hub's one-shot upload param `?upload=1` (01-ux-spec.md §5.1);
 * all other query params are carried through.
 */
export const featureDocumentsRedirectGuard: CanActivateFn = (route: ActivatedRouteSnapshot): boolean | UrlTree => {
	const store = inject(Store);
	const router = inject(Router);

	if (!store.hasFeatureEnabled(FeatureEnum.FEATURE_DOCUMENTS)) {
		return true; // legacy behaves exactly as today
	}

	const queryParams = { ...route.queryParams };
	if (queryParams['openAddDialog'] === 'true') {
		delete queryParams['openAddDialog'];
		queryParams['upload'] = '1';
	}

	return router.createUrlTree(['/pages/documents'], { queryParams });
};
