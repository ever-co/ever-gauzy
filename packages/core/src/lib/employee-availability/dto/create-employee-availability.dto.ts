import { IEmployeeAvailabilityCreateInput } from '@gauzy/contracts';
import { EmployeeAvailability } from '../employee-availability.entity';
import { TenantOrganizationBaseDTO } from '../../core';
import { IntersectionType, PartialType, PickType } from '@nestjs/swagger';

export class CreateEmployeeAvailabilityDTO
	extends IntersectionType(
		PartialType(TenantOrganizationBaseDTO),
		PickType(EmployeeAvailability, [
			'dayOfWeek',
			'startDate',
			'endDate',
			'availabilityNotes',
			'availabilityStatus',
			'employeeId'
		])
	)
	implements IEmployeeAvailabilityCreateInput {}
