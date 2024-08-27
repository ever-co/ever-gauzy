import { TimeLogType } from '@gauzy/contracts';

/**
 * TimeLogsLabel
 */
export const TimeLogsLabel = {
	[TimeLogType.TRACKED]: {
		status: 'success',
		text: TimeLogType.TRACKED
	},
	[TimeLogType.MANUAL]: {
		status: 'warning',
		text: TimeLogType.MANUAL
	},
	[TimeLogType.RESUMED]: {
		status: 'info',
		text: TimeLogType.RESUMED
	},
	[TimeLogType.IDLE]: {
		status: 'primary',
		text: TimeLogType.IDLE
	}
};
