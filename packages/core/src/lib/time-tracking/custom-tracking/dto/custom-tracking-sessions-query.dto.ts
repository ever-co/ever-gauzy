import { ApiPropertyOptional, IntersectionType } from '@nestjs/swagger';
import { IsOptional, IsBoolean, IsString } from 'class-validator';
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
	 * Whether to group by sessionId
	 */
	@ApiPropertyOptional({
		type: () => Boolean,
		description: 'Whether to group tracking sessions by sessionId',
		default: true
	})
	@IsOptional()
	@IsBoolean()
	@Transform(({ value }: TransformFnParams) =>
		value === undefined || value === null || value === '' ? undefined : parseToBoolean(value)
	)
	readonly groupBySession?: boolean = true;

	/**
	 * Whether to include decoded data in the response
	 */
	@ApiPropertyOptional({
		type: () => Boolean,
		default: false,
		description: 'Whether to include decoded data in the response. By default, only encoded data is returned.'
	})
	@IsOptional()
	@IsBoolean()
	@Transform(({ value }: TransformFnParams) =>
		value === undefined || value === null || value === '' ? undefined : parseToBoolean(value)
	)
	readonly includeDecodedData?: boolean = false;

	/**
	 * Filter by specific session ID
	 */
	@ApiPropertyOptional({
		type: () => String,
		description: 'Filter tracking sessions by session ID'
	})
	@IsOptional()
	@IsString()
	readonly sessionId?: string;
}
