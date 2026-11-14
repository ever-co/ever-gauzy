import { IOrganization } from '@gauzy/contracts';
import * as moment from 'moment';
import 'moment-timezone';

/**
 * Formats a stored date as a calendar day of the organization's time zone.
 *
 * The forms save a picked day as the browser's local midnight, so "5 October" picked in UTC+2 is
 * stored as `2026-10-04T22:00:00Z`; formatting that on a UTC server printed 4 October. The
 * organization's zone is the closest thing the server knows to the zone the day was picked in; an
 * organization without one falls back to the server zone, as the reports do.
 */
export function formatInvoiceDay(date: Date | string, organization: IOrganization): string {
	return moment
		.utc(date)
		.tz(invoiceTimeZoneOf(organization))
		.format(organization?.dateFormat || 'YYYY-MM-DD');
}

/** The zone an organization's invoice days are read in: its own, or the server's when it has none. */
export function invoiceTimeZoneOf(organization: Pick<IOrganization, 'timeZone'> | null | undefined): string {
	return organization?.timeZone?.trim() || moment.tz.guess();
}
