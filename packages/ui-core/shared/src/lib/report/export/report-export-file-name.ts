import moment from 'moment';

/** A day of a report's range, as the date range picker and the report requests hold it. */
export type ReportExportDate = Date | string | moment.Moment | null | undefined;

/** Runs of characters that are not safe in a file name on every platform. */
const UNSAFE_FILE_NAME_CHARACTERS = /[^\w.-]+/g;

/**
 * The file name of an exported report, without the extension: its name, then the first and last day of
 * the range it covers, e.g. `time-activity_2026-10-01_2026-10-31`.
 *
 * @param reportName - The report's name, e.g. `time-activity`.
 * @param startDate - The first day of the range; left out when missing or not a date.
 * @param endDate - The last day of the range; left out when missing or not a date.
 * @returns The file name.
 */
export function buildReportExportFileName(
	reportName: string,
	startDate?: ReportExportDate,
	endDate?: ReportExportDate
): string {
	const name =
		(reportName ?? '')
			.trim()
			.replace(UNSAFE_FILE_NAME_CHARACTERS, '-')
			// No leading dot (a hidden file) and no dangling separator
			.replace(/^[-.]+|[-.]+$/g, '') || 'report';
	const days = [startDate, endDate].map(toDay).filter((day): day is string => !!day);
	return [name, ...days].join('_');
}

/**
 * A day as `YYYY-MM-DD`, or `null` when the value is not a date.
 *
 * @param date - The day.
 */
function toDay(date: ReportExportDate): string | null {
	if (!date) {
		return null;
	}
	const day = moment(date);
	return day.isValid() ? day.format('YYYY-MM-DD') : null;
}
