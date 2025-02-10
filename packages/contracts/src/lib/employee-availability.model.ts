import { IBasePerTenantAndOrganizationEntityModel, ID } from './base-entity.model';
import { IEmployee } from './employee.model';

/**
 * Enum representing different availability statuses.
 */
export enum AvailabilityStatusEnum {
	Available = 'Available',
	Partial = 'Partial',
	Unavailable = 'Unavailable'
}

/**
 * Enum mapping availability statuses to numerical values.
 */
export enum AvailabilityStatusValue {
	Available = 0,
	Partial = 1,
	Unavailable = 2
}

/**
 * A mapping object to relate status labels to their respective numerical values.
 */
export const AvailabilityStatusMap: Record<AvailabilityStatusEnum, AvailabilityStatusValue> = {
	[AvailabilityStatusEnum.Available]: AvailabilityStatusValue.Available,
	[AvailabilityStatusEnum.Partial]: AvailabilityStatusValue.Partial,
	[AvailabilityStatusEnum.Unavailable]: AvailabilityStatusValue.Unavailable
};

/**
 * Base interface for Employee Availability data.
 * Includes common properties shared across different input types.
 */
interface IBaseEmployeeAvailability extends IBasePerTenantAndOrganizationEntityModel {
	employeeId: ID;
	startDate: Date;
	endDate: Date;
	dayOfWeek: number; // 0 = Sunday, 6 = Saturday
	availabilityStatus: AvailabilityStatusEnum;
	availabilityNotes?: string;
}

/**
 * Represents an Employee Availability record.
 */
export interface IEmployeeAvailability extends IBaseEmployeeAvailability {
	employee: IEmployee;
}

/**
 * Input interface for finding Employee Availability records.
 */
export interface IEmployeeAvailabilityFindInput extends Partial<IBaseEmployeeAvailability> {}

/**
 * Input interface for creating new Employee Availability records.
 */
export interface IEmployeeAvailabilityCreateInput extends IBaseEmployeeAvailability {}

/**
 * Input interface for updating Employee Availability records.
 */
export interface IEmployeeAvailabilityUpdateInput extends Partial<IBaseEmployeeAvailability> {}
