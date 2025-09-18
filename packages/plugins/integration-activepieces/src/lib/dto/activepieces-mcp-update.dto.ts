import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ActivepiecesMcpToolDto {
	@ApiPropertyOptional({
		description: 'Tool ID',
		type: String,
		required: false
	})
	@IsString()
	@IsOptional()
	readonly id?: string;

	@ApiPropertyOptional({
		description: 'Tool type',
		type: String,
		required: false
	})
	@IsString()
	@IsOptional()
	readonly type?: string;

	@ApiPropertyOptional({
		description: 'Tool metadata',
		type: Object,
		required: false
	})
	@IsOptional()
	readonly pieceMetadata?: Record<string, unknown>;

	@ApiPropertyOptional({
		description: 'Flow ID associated with tool',
		type: String,
		required: false
	})
	@IsString()
	@IsOptional()
	readonly flowId?: string;
}

export class ActivepiecesMcpUpdateDto {
	@ApiPropertyOptional({
		description: 'MCP server name',
		type: String,
		required: false
	})
	@IsString()
	@IsOptional()
	readonly name?: string;

	@ApiPropertyOptional({
		description: 'Array of tools for the MCP server',
		type: [ActivepiecesMcpToolDto],
		required: false
	})
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => ActivepiecesMcpToolDto)
	@IsOptional()
	readonly tools?: ActivepiecesMcpToolDto[];
}
