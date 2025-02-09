import { PartialType } from '@nestjs/mapped-types';
import { IEmployeeAvailabilityUpdateInput } from '@gauzy/contracts';
import { CreateEmployeeAvailabilityDTO } from './create-employee-availability.dto';
import { IntersectionType } from '@nestjs/swagger';

export class UpdateEmployeeAvailabilityDTO
	extends IntersectionType(PartialType(CreateEmployeeAvailabilityDTO))
	implements IEmployeeAvailabilityUpdateInput {}
