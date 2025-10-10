import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsEnum, Min, Max, IsInt } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ActivepiecesConnectionScope, ActivepiecesConnectionStatus } from '@gauzy/contracts';

export class ActivepiecesConnectionsListQueryDto {
	@ApiProperty({
		description: 'Activepieces project ID',
		type: String,
		example: 'project-123'
	})
	@IsString()
	@Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
	@IsNotEmpty()
	readonly projectId!: string;

	@ApiPropertyOptional({
		description: 'Pagination cursor',
		type: String,
		example: 'cursor-abc123'
	})
	@IsOptional()
	@IsString()
	@Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
	readonly cursor?: string;

	@ApiPropertyOptional({
		description: 'Connection scope',
		enum: ActivepiecesConnectionScope,
		example: ActivepiecesConnectionScope.PROJECT
	})
	@IsOptional()
	@IsEnum(ActivepiecesConnectionScope)
	readonly scope?: ActivepiecesConnectionScope;

	@ApiPropertyOptional({
		description: 'Filter by piece name',
		type: String,
		example: 'slack'
	})
	@IsOptional()
	@IsString()
	@Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
	readonly pieceName?: string;

	@ApiPropertyOptional({
		description: 'Filter by display name',
		type: String,
		example: 'My Slack Connection'
	})
	@IsOptional()
	@IsString()
	@Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
	readonly displayName?: string;

	@ApiPropertyOptional({
		description: 'Filter by connection status',
		enum: ActivepiecesConnectionStatus,
		example: ActivepiecesConnectionStatus.ACTIVE
	})
	@IsOptional()
	@IsEnum(ActivepiecesConnectionStatus)
	readonly status?: ActivepiecesConnectionStatus;

	@ApiPropertyOptional({
		description: 'Number of results to return',
		type: Number,
		minimum: 1,
		example: 10,
		default: 10,
		maximum: 100
	})
	@IsInt()
	@Min(1)
	@Max(100)
	@Type(() => Number)
	readonly limit: number = 10;
}
