import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router } from '@angular/router';
import { DashboardStoreService } from './dashboard-store.service';

/** Base path of the dashboard page. */
const DASHBOARD_BASE = '/pages/dashboard';

/** Path of the custom dashboard host route. */
const CUSTOM_DASHBOARD_BASE = `${DASHBOARD_BASE}/custom`;

/** Componentless route used as an intermediate hop to force widget host re-creation. */
const SWITCHING_PATH = `${DASHBOARD_BASE}/switching`;

/**
 * Guard for the `custom/:id` dashboard route.
 *
 * Applies the selected dashboard's saved widget layout BEFORE the widget host
 * component initializes, so the layout components deserialize the applied state.
 *
 * When navigating from one custom dashboard to another (same route config,
 * param-only change), Angular would re-use the component tree and the new
 * layout would not be re-applied. In that case the guard cancels the current
 * navigation and re-issues it through an intermediate componentless route so
 * the widget host is destroyed and re-created.
 */
export const customDashboardGuard: CanActivateFn = async (route: ActivatedRouteSnapshot) => {
	const router = inject(Router);
	const dashboardStore = inject(DashboardStoreService);

	const id = route.paramMap.get('id');
	if (!id) {
		return router.parseUrl(`${DASHBOARD_BASE}/time-tracking`);
	}

	// Force component re-creation when already on a custom dashboard route
	if (router.url.startsWith(CUSTOM_DASHBOARD_BASE)) {
		void router
			.navigateByUrl(SWITCHING_PATH, { skipLocationChange: true })
			.then(() => router.navigateByUrl(`${CUSTOM_DASHBOARD_BASE}/${id}`));
		return false;
	}

	try {
		await dashboardStore.selectById(id);
		return true;
	} catch (error) {
		console.error('Failed to apply custom dashboard', error);
		return router.parseUrl(`${DASHBOARD_BASE}/time-tracking`);
	}
};

/**
 * Guard for the standard dashboard tab routes (time-tracking, teams, etc.).
 *
 * Restores the Standard widget layout when a custom dashboard was active,
 * before the standard widget host initializes. No-op otherwise.
 */
export const standardDashboardGuard: CanActivateFn = () => {
	inject(DashboardStoreService).ensureStandardLayout();
	return true;
};

/**
 * Guard for the empty `/pages/dashboard` path.
 *
 * Redirects to the user's default custom dashboard when one exists,
 * otherwise to the standard time-tracking tab.
 */
export const defaultDashboardGuard: CanActivateFn = async () => {
	const router = inject(Router);
	const dashboardStore = inject(DashboardStoreService);

	try {
		const dashboard = await dashboardStore.resolveDefaultDashboard();
		return dashboard
			? router.parseUrl(`${CUSTOM_DASHBOARD_BASE}/${dashboard.id}`)
			: router.parseUrl(`${DASHBOARD_BASE}/time-tracking`);
	} catch (error) {
		console.error('Failed to resolve default dashboard', error);
		return router.parseUrl(`${DASHBOARD_BASE}/time-tracking`);
	}
};
