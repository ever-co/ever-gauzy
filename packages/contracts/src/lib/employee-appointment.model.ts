import { ID, IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { IAppointmentEmployee } from './appointment-employees.model';
import { IEmployee, IEmployeeFindInput } from './employee.model';
import { IOrganizationFindInput } from './organization.model';

/**
 * Employee appointment status.
 */
export enum EmployeeAppointmentStatus {
	SCHEDULED = 'Scheduled',
	CANCELLED = 'Cancelled',
	COMPLETED = 'Completed'
}

export interface IEmployeeAppointment extends IBasePerTenantAndOrganizationEntityModel {
	employee?: IEmployee;
	employeeId?: string;
	description?: string;
	location?: string;
	agenda: string;
	startDateTime: Date;
	endDateTime: Date;
	bufferTimeStart?: Boolean;
	bufferTimeEnd?: Boolean;
	bufferTimeInMins?: Number;
	breakTimeInMins?: Number;
	breakStartTime?: Date;
	invitees?: IAppointmentEmployee[];
	emails?: string;
	status?: EmployeeAppointmentStatus;
}

export interface IEmployeeAppointmentFindInput {
	employee?: IEmployeeFindInput;
	employeeId?: string;
	status?: EmployeeAppointmentStatus;
	organization?: IOrganizationFindInput;
}

export interface IEmployeeAppointmentCreateInput extends IBasePerTenantAndOrganizationEntityModel {
	employeeId?: string;
	description?: string;
	location?: string;
	agenda: string;
	startDateTime: Date;
	endDateTime: Date;
	bufferTimeStart?: Boolean;
	bufferTimeEnd?: Boolean;
	bufferTimeInMins?: Number;
	breakTimeInMins?: Number;
	breakStartTime?: Date;
	emails?: string;
	invitees?: IAppointmentEmployee[];
	/**
	 * The employees of the organization invited to the meeting. Each one gets a `Meeting` notification (in-app, then
	 * email and push as their preferences say), and reads the meeting through `GET /employee-appointment/invited`. The
	 * addresses in `emails` keep the short appointment email they always had.
	 */
	inviteeEmployeeIds?: ID[];
}

export interface IEmployeeAppointmentUpdateInput extends IBasePerTenantAndOrganizationEntityModel {
	employeeId?: string;
	description?: string;
	location?: string;
	agenda?: string;
	startDateTime?: Date;
	endDateTime?: Date;
	bufferTimeStart?: Boolean;
	bufferTimeEnd?: Boolean;
	bufferTimeInMins?: Number;
	breakTimeInMins?: Number;
	breakStartTime?: Date;
	status?: EmployeeAppointmentStatus;
	invitees?: IAppointmentEmployee[];
	/**
	 * The employees invited to the meeting from now on, when sent: those added are told they are invited, those left
	 * out that they no longer are. Left out of the request, the invitees stay as they were.
	 */
	inviteeEmployeeIds?: ID[];
}

/** A meeting an employee is invited to, as `GET /employee-appointment/invited` lists it. */
export interface IEmployeeAppointmentInvitation {
	id: ID;
	agenda: string;
	description?: string | null;
	location?: string | null;
	startDateTime: Date;
	endDateTime: Date;
	status?: EmployeeAppointmentStatus | null;
	organizationId: ID;
	/** Who hosts it: the employee whose appointment it is. */
	host: { employeeId: ID | null; name: string | null };
}

/**
 * The range `GET /employee-appointment/invited` lists, by the meetings' times (both optional). Without `startDate`, the
 * range starts now: the meetings not over yet; an earlier `startDate` lists past ones too.
 */
export interface IEmployeeAppointmentInvitationFindInput {
	startDate?: Date | string;
	endDate?: Date | string;
}

/**
 * A reminder the platform filed about a meeting for one of the employees who host or attend it (ever-co/ever-teams#5022):
 * level 1 at the employee's lead before the start, level 2 when it is about to start. One per meeting, employee, level
 * and start: a meeting moved to another time is reminded of again at its new time.
 */
export interface IEmployeeAppointmentReminder extends IBasePerTenantAndOrganizationEntityModel {
	employeeAppointment?: IEmployeeAppointment;
	employeeAppointmentId: ID;
	employee?: IEmployee;
	employeeId: ID;
	level: number;
	/** The start the reminder was for. */
	startDateTime: Date;
	/** The id its notification is filed under, chosen with the claim. */
	employeeNotificationId: ID;
	/** When the claim was taken, or taken over from a process that stopped before it filed the notification. */
	claimedAt: Date;
	/** When its notification was filed; unset while it is not. */
	filedAt?: Date;
}
