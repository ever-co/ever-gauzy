/**
 * The aggregate counts `GET /public/stats` answers: this installation as a whole, never one tenant's share
 * of it. Every field is a number of rows (or of hours); no identifier, name, address or amount leaves the
 * API through it.
 */
export interface PublicStats {
	/** Tenants registered. */
	tenants: number;
	/** Tenants registered in the last 90 days (`PUBLIC_STATS_NEW_TENANT_WINDOW_DAYS`). */
	tenantsLast90Days: number;
	/** User accounts, minus the accounts behind agent employees: those are not people and never sign in. */
	users: number;
	/** Human employees (`employee.kind = 'human'`). */
	employees: number;
	/** Organization teams. */
	teams: number;
	/** Organization projects. */
	projects: number;
	/** Time-tracker screenshots. */
	screenshots: number;
	/** Tracked time: the sum of every time slot's duration, in whole hours, rounded down. */
	hoursTracked: number;
	/** When these figures were computed (ISO 8601). */
	computedAt: string;
}
