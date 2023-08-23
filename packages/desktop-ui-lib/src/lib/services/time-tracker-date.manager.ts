import * as moment from 'moment';
import { IOrganization } from '@gauzy/contracts';

export class TimeTrackerDateManager {
	private static _instance: TimeTrackerDateManager;
	private _organization: IOrganization;
	private _utcOffset: number;

	private constructor() {
		this._utcOffset = moment().utcOffset();
	}

	private static get instance(): TimeTrackerDateManager {
		if (!this._instance) {
			this._instance = new TimeTrackerDateManager();
		}
		return this._instance;
	}

	private static get _startWeekDayNumber(): number {
		return moment()
			.day(this.organization?.startWeekOn || 'Monday')
			.weekday();
	}

	public static get startWeek(): string {
		return moment()
			.startOf('week')
			.add(this._startWeekDayNumber, 'day')
			.subtract(this.utcOffset, 'minutes')
			.format('YYYY-MM-DD HH:mm:ss');
	}

	public static get endWeek(): string {
		return moment(this.startWeek)
			.add('7', 'days')
			.format('YYYY-MM-DD HH:mm:ss');
	}

	public static get startToday(): string {
		return moment()
			.startOf('day')
			.subtract(this.utcOffset, 'minutes')
			.format('YYYY-MM-DD HH:mm:ss');
	}

	public static get endToday(): string {
		return moment()
			.endOf('day')
			.subtract(this.utcOffset, 'minutes')
			.format('YYYY-MM-DD HH:mm:ss');
	}

	public static get utcOffset(): number {
		return this.instance._utcOffset;
	}

	public static get organization(): IOrganization {
		return this.instance._organization;
	}

	public static set organization(value: IOrganization) {
		this.instance._organization = value;
	}

	public static set utcOffset(value: number) {
		this.instance._utcOffset = value;
	}
}
