import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { ICandidateUpdateInput } from '@gauzy/contracts';
import { UpdateProfileDTO } from './../../employee/dto';

export class UpdateCandidateDTO extends UpdateProfileDTO implements ICandidateUpdateInput {
	@ApiProperty({ type: () => Date })
	@IsOptional()
	readonly appliedDate?: Date;

	@ApiProperty({ type: () => Date })
	@IsOptional()
	readonly hiredDate?: Date;

	@ApiProperty({ type: () => String })
	@IsString()
	@IsOptional()
	readonly cvUrl?: string;

	@ApiProperty({ type: () => String })
	@IsString()
	@IsOptional()
	readonly candidateLevel?: string;
}
