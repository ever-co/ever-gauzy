import { ApiProperty, IntersectionType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
	IsArray,
	IsNotEmpty,
	IsNotEmptyObject,
	IsObject,
	IsOptional,
	MinLength,
	ValidateNested
} from 'class-validator';
import { ICandidateCreateInput, ICandidateDocument } from '@gauzy/contracts';
import { RelationalTagDTO } from './../../tags/dto';
import { EmploymentDTO, UserInputDTO } from './../../employee/dto';

/**
 * Candidate Create DTO
 *
 */
export class CreateCandidateDTO
	extends IntersectionType(EmploymentDTO, RelationalTagDTO)
	implements ICandidateCreateInput
{
	@ApiProperty({ type: () => UserInputDTO, required: true })
	@IsObject()
	@IsNotEmptyObject()
	@ValidateNested()
	@Type(() => UserInputDTO)
	readonly user: UserInputDTO;

	@ApiProperty({ type: () => String, required: true })
	@IsNotEmpty({ message: 'Password should not be empty' })
	@MinLength(4, {
		message: 'Password should be at least 4 characters long.'
	})
	readonly password: string;

	@ApiProperty({ type: () => Object })
	@IsOptional()
	@IsArray()
	readonly documents: ICandidateDocument[];
}
