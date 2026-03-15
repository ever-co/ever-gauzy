import { IEstimateEmailFindInput } from '@gauzy/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { parseRelationsString } from './../../shared/dto';

/**
 * Allowed relations for the estimate-email validation endpoint.
 *
 * Only relations whose columns are explicitly constrained by the service's
 * `select` clause are permitted.  Any relation not in this enum will be
 * rejected by class-validator.
 */
export enum EstimateEmailRelationEnum {
	'tenant' = 'tenant',
	'organization' = 'organization'
}

/**
 * Find estimate email request DTO validation
 */
export class FindEstimateEmailQueryDTO implements IEstimateEmailFindInput {
	@ApiProperty({ type: () => String, readOnly: true })
	@IsNotEmpty()
	@IsEmail()
	readonly email: string;

	@ApiProperty({ type: () => String, readOnly: true })
	@IsNotEmpty()
	@IsString()
	readonly token: string;

	@ApiPropertyOptional({ type: () => String, enum: EstimateEmailRelationEnum })
	@IsOptional()
	@Transform(parseRelationsString)
	@IsEnum(EstimateEmailRelationEnum, { each: true })
	readonly relations: string[] = [];
}
