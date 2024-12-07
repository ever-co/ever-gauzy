import { ApiProperty } from '@nestjs/swagger';
import { TenantOrganizationBaseDTO } from '../../../core/dto';
import { IsUUID, IsNumber } from 'class-validator';

export class TaskEstimationDTO extends TenantOrganizationBaseDTO {
	@ApiProperty({ type: () => Number })
	@IsNumber()
	estimate: number;

	@ApiProperty({ type: () => String })
	@IsUUID()
	employeeId: string;

	@ApiProperty({ type: () => String })
	@IsUUID()
	taskId: string;
}
