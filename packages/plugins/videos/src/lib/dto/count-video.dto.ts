import { ApiProperty } from '@nestjs/swagger';
import { IsISO8601, IsOptional, IsUUID } from 'class-validator';

/**
 * Entity Count Video DTO
 *
 * Represents the DTO for counting videos within a specific tenant and organization,
 * optionally filtered by a date range.
 */
export class CountVideoDTO {
	/**
	 * The ID of the tenant.
	 *
	 * @example 'd3b07384-d9a0-4d5f-bf6d-f1b5b71e9a37'
	 */
	@ApiProperty({
		description: 'The ID of the tenant.',
		example: 'd3b07384-d9a0-4d5f-bf6d-f1b5b71e9a37',
		type: String
	})
	@IsUUID('4', { message: 'tenantId must be a valid UUID' })
	tenantId: string;

	/**
	 * The ID of the organization within the tenant.
	 *
	 * @example 'a9e3fbc9-d0b7-4e85-b6f2-2eaf3a5d72dc'
	 */
	@ApiProperty({
		description: 'The ID of the organization within the tenant.',
		example: 'a9e3fbc9-d0b7-4e85-b6f2-2eaf3a5d72dc',
		type: String
	})
	@IsUUID('4', { message: 'organizationId must be a valid UUID' })
	organizationId: string;

	/**
	 * The start date for filtering video records.
	 * Can be provided as a string or a Date object.
	 *
	 * @example '2023-01-01T00:00:00.000Z'
	 */
	@ApiProperty({
		description: 'The start date for filtering video records. Can be provided as a string or a Date object.',
		example: '2023-01-01T00:00:00.000Z',
		type: 'string',
		format: 'date-time',
		nullable: true
	})
	@IsOptional()
	@IsISO8601({ strict: true }, { message: 'startDate must be a valid ISO 8601 date string' })
	startDate: Date | string;

	/**
	 * The end date for filtering video records.
	 * Can be provided as a string or a Date object.
	 *
	 * @example '2023-12-31T23:59:59.999Z'
	 */
	@ApiProperty({
		description: 'The end date for filtering video records. Can be provided as a string or a Date object.',
		example: '2023-12-31T23:59:59.999Z',
		type: 'string',
		format: 'date-time',
		nullable: true
	})
	@IsOptional()
	@IsISO8601({ strict: true }, { message: 'endDate must be a valid ISO 8601 date string' })
	endDate: Date | string;
}
