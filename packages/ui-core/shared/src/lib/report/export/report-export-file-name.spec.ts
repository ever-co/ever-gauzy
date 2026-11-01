import moment from 'moment';
import { buildReportExportFileName } from './report-export-file-name';

describe('buildReportExportFileName', () => {
	it('names the report and the first and last day of its range', () => {
		expect(buildReportExportFileName('time-activity', new Date(2026, 9, 1), new Date(2026, 9, 31, 23, 59))).toBe(
			'time-activity_2026-10-01_2026-10-31'
		);
	});

	it('reads the days from moments and strings too', () => {
		expect(buildReportExportFileName('weekly', moment('2026-10-26'), '2026-11-01 23:59:59')).toBe(
			'weekly_2026-10-26_2026-11-01'
		);
	});

	it('leaves out a day that is missing or not a date', () => {
		expect(buildReportExportFileName('time-activity')).toBe('time-activity');
		expect(buildReportExportFileName('time-activity', new Date(2026, 9, 1), null)).toBe('time-activity_2026-10-01');
		expect(buildReportExportFileName('time-activity', new Date('nope'), new Date(2026, 9, 31))).toBe(
			'time-activity_2026-10-31'
		);
	});

	it('replaces characters that are not safe in a file name', () => {
		expect(buildReportExportFileName(' Time & Activity/report ')).toBe('Time-Activity-report');
		expect(buildReportExportFileName('../../etc')).toBe('etc');
		expect(buildReportExportFileName('.hidden')).toBe('hidden');
	});

	it('falls back to a generic name when nothing safe is left', () => {
		expect(buildReportExportFileName('  ')).toBe('report');
		expect(buildReportExportFileName('///')).toBe('report');
	});
});
