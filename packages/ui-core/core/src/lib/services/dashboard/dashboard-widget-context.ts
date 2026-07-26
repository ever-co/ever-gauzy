import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { ID, IOrganization, ISelectedEmployee, TimeFormatEnum } from '@gauzy/contracts';

/**
 * Ambient context handed to every widget rendered on a dashboard canvas.
 *
 * A canvas-hosted widget is instantiated dynamically and therefore cannot rely
 * on the page-level selector components (date range picker, employee/project
 * selectors) being its ancestors. Instead the canvas resolves the current
 * selection once and provides it through {@link DASHBOARD_WIDGET_CONTEXT}, with
 * per-placement overrides applied (a widget can be scoped to one project even
 * when the page selector says "all projects").
 */
export interface IDashboardWidgetContext {
	tenantId: ID;
	organizationId: ID;
	organization?: IOrganization;

	/** Selected reporting window. */
	startDate: Date;
	endDate: Date;
	/** Convenience bounds for "today" widgets, in the organization's time zone. */
	todayStart: Date;
	todayEnd: Date;

	timeZone: string;
	timeFormat?: TimeFormatEnum;
	currency?: string;

	/** Active scope. Empty/undefined means "everything the user may see". */
	employeeIds?: ID[];
	projectIds?: ID[];
	teamIds?: ID[];
	selectedEmployee?: ISelectedEmployee;
}

/**
 * Stream of the current {@link IDashboardWidgetContext}.
 *
 * Provided by the canvas host per widget instance, so each widget can receive a
 * context narrowed by its own placement configuration.
 */
export const DASHBOARD_WIDGET_CONTEXT = new InjectionToken<Observable<IDashboardWidgetContext>>(
	'DASHBOARD_WIDGET_CONTEXT'
);

/**
 * The persisted per-instance configuration of the widget being rendered
 * (the placement's `config` object). Empty when the widget has no settings.
 */
export const DASHBOARD_WIDGET_CONFIG = new InjectionToken<Record<string, unknown>>('DASHBOARD_WIDGET_CONFIG');
