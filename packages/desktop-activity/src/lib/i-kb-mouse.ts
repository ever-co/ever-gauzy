/**
 * Represents mouse movement events with start and end coordinates.
 */
export type TMouseEvents = {
	moveTo: {
		from: {
			x: number;
			y: number;
		},
		to: {
			x: number;
			y: number;
		}
	}
}

/**
 * Aggregates keyboard and mouse activity data for tracking user interactions.
 */
export type TKbMouseActivity = {
	kbPressCount: number;
	kbSequence: number[];
	mouseMovementsCount: number;
	mouseLeftClickCount: number;
	mouseRightClickCount: number;
	mouseEvents: TMouseEvents[]
}

export enum TimeLogType {
    TRACKED = "TRACKED",
    MANUAL = "MANUAL",
    IDLE = "IDLE",
    RESUMED = "RESUMED"
}

export enum ActivityType {
	URL = 'URL',
	APP = 'APP'
}

export enum TimeLogSourceEnum {
	MOBILE = 'MOBILE',
	WEB_TIMER = 'BROWSER',
	DESKTOP = 'DESKTOP',
	BROWSER_EXTENSION = 'BROWSER_EXTENSION',
	HUBSTAFF = 'HUBSTAFF',
	UPWORK = 'UPWORK',
	TEAMS = 'TEAMS',
	CLOC = 'CLOC'
}

export type TimeSlotActivities = {
	title: string,
	date: string, // format day YYYY-MM-DD
	time: string, // format time HH:mm:ss
	duration: number,
	type: ActivityType,
	taskId: string | null,
	projectId: string | null,
	organizationContactId: string | null,
	organizationId: string,
	employeeId: string,
	source: TimeLogSourceEnum,
	recordedAt: Date,
	metaData: Record<string, unknown>[] | unknown[]

}

export type TWindowActivities = {
	name: string;
	duration: number;
	dateStart: Date;
	dateEnd: Date;
	meta: {
		url?: string;
		title: string;
		platform?: string;
	}[]
}
