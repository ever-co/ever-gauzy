import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { IUserCodeInput } from '@gauzy/contracts';
import { ALPHA_NUMERIC_CODE_LENGTH } from '@gauzy/constants';
import { CustomLength } from './../../shared/validators';

/**
 * User code input DTO validation
 */
export class UserCodeDTO implements IUserCodeInput {
	@ApiProperty({ type: () => Number })
	@IsString()
	@CustomLength(ALPHA_NUMERIC_CODE_LENGTH)
	readonly code: string;
}
