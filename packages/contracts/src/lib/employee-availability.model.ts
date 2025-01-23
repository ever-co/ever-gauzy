import { IBasePerTenantAndOrganizationEntityModel, ID } from './base-entity.model';
import { IEmployee } from './employee.model';

/**
 * Enum representing the availability status of an employee.
 */
export enum AvailabilityStatusEnum {
	Available = 'Available',
	Partial = 'Partial',
	Unavailable = 'Unavailable'
}

export enum AvailabilityStatusValue {
	Available = 0,
	Partial = 1,
	Unavailable = 2
}

export interface IEmployeeAvailability extends IBasePerTenantAndOrganizationEntityModel {
	employee: IEmployee;
	employeeId: ID;
	startDate: Date;
	endDate: Date;
	dayOfWeek: number; // 0 = Sunday, 6 = Saturday
	availabilityStatus: AvailabilityStatusEnum;
	availabilityNotes?: string;
}

/**
 * Input interface for finding Employee Availability records.
 */
export interface IEmployeeAvailabilityFindInput {
	employeeId?: ID;
	availabilityStatus?: AvailabilityStatusEnum;
	startDate?: Date;
	endDate?: Date;
}

/**
 * Input interface for creating new Employee Availability records.
 */
export interface IEmployeeAvailabilityCreateInput extends IBasePerTenantAndOrganizationEntityModel {
	employeeId: ID;
	startDate: Date;
	endDate: Date;
	dayOfWeek: number; // 0 = Sunday, 6 = Saturday
	availabilityStatus: AvailabilityStatusEnum;
	availabilityNotes?: string;
}

/**
 * Input interface for updating Employee Availability records.
 */
export interface IEmployeeAvailabilityUpdateInput extends IBasePerTenantAndOrganizationEntityModel {
	employeeId?: ID;
	startDate?: Date;
	endDate?: Date;
	dayOfWeek?: number; // 0 = Sunday, 6 = Saturday
	availabilityStatus?: AvailabilityStatusEnum;
	availabilityNotes?: string;
}
