import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';
import { IEmployeePresenceInput } from '@gauzy/contracts';

export class EmployeePresenceDTO implements IEmployeePresenceInput {
	@ApiProperty({ type: () => Boolean })
	@IsBoolean()
	readonly isIdle: boolean;
}
