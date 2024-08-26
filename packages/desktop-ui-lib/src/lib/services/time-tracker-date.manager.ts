import { IOrganization, LanguagesEnum } from '@gauzy/contracts';
import * as moment from 'moment';

export class TimeTrackerDateManager {
	private static _instance: TimeTrackerDateManager;
	private _organization: IOrganization;
	private _utcOffset: number;
	private _language: LanguagesEnum;

	private constructor() {
		this._utcOffset = moment().utcOffset();
		this._language = LanguagesEnum.ENGLISH;
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
			.isoWeekday();
	}

	public static get startWeek(): string {
		return moment().startOf('week').subtract(this.utcOffset, 'minutes').format('YYYY-MM-DD HH:mm:ss');
	}

	public static get endWeek(): string {
		return moment().endOf('week').subtract(this.utcOffset, 'minutes').format('YYYY-MM-DD HH:mm:ss');
	}

	public static get startToday(): string {
		return moment().startOf('day').subtract(this.utcOffset, 'minutes').format('YYYY-MM-DD HH:mm:ss');
	}

	public static get endToday(): string {
		return moment().endOf('day').subtract(this.utcOffset, 'minutes').format('YYYY-MM-DD HH:mm:ss');
	}

	public static get utcOffset(): number {
		return this.instance._utcOffset;
	}

	public static get organization(): IOrganization {
		return this.instance._organization;
	}

	public static set organization(value: IOrganization) {
		this.instance._organization = value;
		// Set the start of the week when organization's change
		this._instance.startWeekDay();
	}

	public static set utcOffset(value: number) {
		this.instance._utcOffset = value;
	}

	/**
	 * @returns True If it's currently midnight, otherwise False.
	 */
	public static get isMidnight(): boolean {
		const now = moment();
		const endOfDay = now.clone().endOf('day');
		return moment(now.format('YYYY-MM-DD HH:mm:ss')).isSame(endOfDay.format('YYYY-MM-DD HH:mm:ss'));
	}

	// Set the start of the week
	private startWeekDay() {
		moment.updateLocale(this._language, {
			week: {
				dow: TimeTrackerDateManager._startWeekDayNumber
			}
		});
	}

	public static locale(language = LanguagesEnum.ENGLISH) {
		moment.locale(language);
		this.instance._language = language;
	}

	public static get startCurrentDay(): string {
		return moment().startOf('day').format('YYYY-MM-DD HH:mm:ss');
	}

	public static get endCurrentDay(): string {
		return moment().endOf('day').format('YYYY-MM-DD HH:mm:ss');
	}

	public static get startCurrentWeek(): string {
		return moment().startOf('week').format('YYYY-MM-DD HH:mm:ss');
	}

	public static get endCurrentWeek(): string {
		return moment().endOf('week').format('YYYY-MM-DD HH:mm:ss');
	}
}
