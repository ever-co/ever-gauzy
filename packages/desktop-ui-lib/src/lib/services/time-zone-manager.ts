import { TimeTrackerDateManager } from './time-tracker-date.manager';
import moment from 'moment';;

export enum ZoneEnum {
	LOCAL = 'local',
	UTC = 'utc',
}

export class TimeZoneManager {
	public static changeZone(value: ZoneEnum) {
		switch (value) {
			case ZoneEnum.UTC:
				TimeTrackerDateManager.utcOffset = 0;
				break;
			case ZoneEnum.LOCAL:
				TimeTrackerDateManager.utcOffset = moment().utcOffset();
				break;
			default:
				break;
		}
	}

	public static get zones() {
		return [
			{
				translation: 'TIMER_TRACKER.SETTINGS.TIMEZONE_LOCAL',
				name: ZoneEnum.LOCAL,
			},
			{
				translation: 'TIMER_TRACKER.SETTINGS.TIMEZONE_UTC',
				name: ZoneEnum.UTC,
			},
		];
	}
}
