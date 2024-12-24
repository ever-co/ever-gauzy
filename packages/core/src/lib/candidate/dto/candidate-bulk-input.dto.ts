import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, ValidateNested } from 'class-validator';
import { CreateCandidateDTO } from './create-candidate.dto';

export class CandidateBulkInputDTO {
	@ApiProperty({ type: () => Array, required: true })
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => CreateCandidateDTO)
	readonly list: CreateCandidateDTO[];
}
