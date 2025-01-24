import { EmployeeAvailabilityBulkCreateHandler } from './employee-availability.bulk.create.handler';
import { EmployeeAvailabilityCreateHandler } from './employee-availability.create.handler';

/**
 * Exports all command handlers for EmployeeAvailability.`
 */
export const CommandHandlers = [EmployeeAvailabilityBulkCreateHandler, EmployeeAvailabilityCreateHandler];
