import { ApiPropertyOptional, IntersectionType } from '@nestjs/swagger';
import { IsOptional, IsUUID, IsBoolean } from 'class-validator';
import { Transform, TransformFnParams } from 'class-transformer';
import { parseToBoolean } from '@gauzy/utils';
import { FiltersQueryDTO, SelectorsQueryDTO, RelationsQueryDTO } from '../../../shared/dto';

/**
 * DTO for querying custom tracking sessions
 */
export class CustomTrackingSessionsQueryDTO extends IntersectionType(
	FiltersQueryDTO,
	IntersectionType(SelectorsQueryDTO, RelationsQueryDTO)
) {
	/**
	 * Whether to include decoded tracking data
	 */
	@ApiPropertyOptional({
		type: () => Boolean,
		description: 'Whether to include decoded tracking data in the response'
	})
	@IsOptional()
	@IsBoolean()
	@Transform(({ value }: TransformFnParams) => parseToBoolean(value))
	readonly includeDecoded?: boolean = true;

	/**
	 * Whether to group by sessionId
	 */
	@ApiPropertyOptional({
		type: () => Boolean,
		description: 'Whether to group tracking sessions by sessionId'
	})
	@IsOptional()
	@IsBoolean()
	@Transform(({ value }: TransformFnParams) => parseToBoolean(value))
	readonly groupBySession?: boolean = true;

	/**
	 * Filter by specific employee
	 */
	@ApiPropertyOptional({
		type: () => String,
		description: 'Filter tracking sessions by employee ID'
	})
	@IsOptional()
	@IsUUID()
	readonly employeeId?: string;

	/**
	 * Filter by specific project
	 */
	@ApiPropertyOptional({
		type: () => String,
		description: 'Filter tracking sessions by project ID'
	})
	@IsOptional()
	@IsUUID()
	readonly projectId?: string;
}
