import { ID } from './base-entity.model';

/**
 * The kinds of change a time entry's history can be filtered by. A row of the history (an activity log row whose
 * entity is `TimeLog`) is of every kind its changed fields belong to, plus `CREATED` or `DELETED` for those actions.
 */
export enum TimeLogChangeKindEnum {
	/** Added by hand. */
	CREATED = 'CREATED',
	/** Its start or end moved. */
	TIME = 'TIME',
	/** Its task changed. */
	TASK = 'TASK',
	/** Its project or client changed. */
	PROJECT = 'PROJECT',
	/** It moved to another member. */
	MEMBER = 'MEMBER',
	/** Its billable state changed. */
	BILLABLE = 'BILLABLE',
	/** Its notes changed. */
	NOTES = 'NOTES',
	/** The status of its timesheet changed (approved, denied, ...). */
	STATUS = 'STATUS',
	/** Deleted. */
	DELETED = 'DELETED'
}

/** The changes of a period, as `GET /timesheet/time-log/history` reads them. */
export interface ITimeLogHistoryFindInput {
	organizationId: ID;
	tenantId?: ID;
	/** The first moment of the period: changes recorded at or after it. */
	startDate: Date | string;
	/** The last moment of the period: changes recorded at or before it. */
	endDate: Date | string;
	/** The members whose entries changed; the caller's own entries when left out and the caller may see no one else. */
	employeeIds?: ID[];
	/** Only changes of these kinds; every kind when left out. */
	kinds?: TimeLogChangeKindEnum[];
	/** Page size (default 100, at most 500). */
	take?: number;
	/** 1-based page number. */
	skip?: number;
}
