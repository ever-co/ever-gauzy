import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { IUserLogoutInput } from '@gauzy/contracts';

export class UserLogoutDTO implements IUserLogoutInput {
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	readonly userId: string;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	readonly lastTeamId: string;

	@ApiProperty({ type: () => String })
	@IsOptional()
	@IsString()
	readonly lastOrganizationId: string;
}
