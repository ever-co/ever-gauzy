import * as moment from 'moment';
import { isBetterSqlite3, isSqlite } from '@gauzy/config';

/**
 * Whether plan dates are stored in UTC. TypeORM writes a SQLite datetime as a UTC string, while on
 * PostgreSQL and MySQL it hands the Date to the driver, which writes it in the API process's local time.
 */
const storesDatesInUtc = (): boolean => isSqlite() || isBetterSqlite3();

function inStoredZone(value: moment.MomentInput, format?: string): moment.Moment {
	if (storesDatesInUtc()) {
		return moment.utc(value, format);
	}
	return moment(value, format);
}

/**
 * The day a plan dated `date` is stored under, as `YYYY-MM-DD`: the date part of the stored value, which is
 * what the unique index keys on. It is the UTC day on SQLite and on a process running in UTC, the usual
 * deployment, and the process's local day otherwise.
 */
export const storedPlanDay = (date: Date | string): string => inStoredZone(date).format('YYYY-MM-DD');

/**
 * The instant a stored day starts, for a bound passed to the database as a Date, which the driver writes the
 * same way as the plan dates.
 */
export const storedDayStart = (day: string): Date => inStoredZone(day, 'YYYY-MM-DD').toDate();
