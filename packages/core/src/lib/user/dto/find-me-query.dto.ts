import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';
import { Transform, TransformFnParams } from 'class-transformer';
import { parseToBoolean } from '@gauzy/utils';
import { IFindMeUser } from '@gauzy/contracts';
import { RelationsQueryDTO } from './../../shared/dto';

/**
 * DTO for "find me" queries to retrieve logged-in user details, extending from RelationsQueryDTO.
 */
export class FindMeQueryDTO extends RelationsQueryDTO implements IFindMeUser {
	/**
	 * Optional flag to include employee details in the response.
	 * It is marked as optional in the API documentation.
	 * If provided, its value is transformed to a boolean; defaults to false if not provided.
	 */
	@ApiPropertyOptional({ type: Boolean })
	@IsOptional()
	@Transform(({ value }: TransformFnParams) => (value ? parseToBoolean(value) : false))
	readonly includeEmployee: boolean;

	/**
	 * Optional flag to include organization details inside the employee response.
	 * It is marked as optional in the API documentation.
	 * If provided, its value is transformed to a boolean; defaults to false if not provided.
	 */
	@ApiPropertyOptional({ type: Boolean })
	@IsOptional()
	@Transform(({ value }: TransformFnParams) => (value ? parseToBoolean(value) : false))
	readonly includeOrganization: boolean;
}
