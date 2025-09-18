import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsEnum, IsNumber, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ActivepiecesConnectionScope, ActivepiecesConnectionStatus } from '../activepieces.type';

export class ActivepiecesConnectionsListQueryDto {
	@ApiProperty({
		description: 'ActivePieces project ID',
		type: String,
		example: 'project-123'
	})
	@IsString()
	@IsNotEmpty()
	readonly projectId!: string;

	@ApiPropertyOptional({
		description: 'Pagination cursor',
		type: String,
		example: 'cursor-abc123'
	})
	@IsOptional()
	@IsString()
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
	readonly pieceName?: string;

	@ApiPropertyOptional({
		description: 'Filter by display name',
		type: String,
		example: 'My Slack Connection'
	})
	@IsOptional()
	@IsString()
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
		example: 10
	})
	@IsOptional()
	@IsNumber()
	@Min(1)
	@Type(() => Number)
	readonly limit?: number;
}