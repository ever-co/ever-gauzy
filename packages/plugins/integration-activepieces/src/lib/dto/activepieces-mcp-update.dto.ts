import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray, ValidateNested, ArrayNotEmpty, IsNotEmpty, IsObject } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class ActivepiecesMcpToolDto {
	@ApiPropertyOptional({
		description: 'Tool ID',
		type: String,
		required: false
	})
	@IsString()
	@IsOptional()
	@Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
	readonly id?: string;

	@ApiPropertyOptional({
		description: 'Tool type',
		type: String,
		required: false
	})
	@IsString()
	@IsOptional()
	@Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
	readonly type?: string;

	@ApiPropertyOptional({
		description: 'Tool metadata',
		type: Object,
		required: false
	})
	@IsOptional()
	@IsObject()
	readonly pieceMetadata?: Record<string, unknown>;

	@ApiPropertyOptional({
		description: 'Flow ID associated with tool',
		type: String,
		required: false
	})
	@IsString()
	@IsOptional()
	@Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
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
	@IsNotEmpty()
	@Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
	readonly name?: string;

	@ApiPropertyOptional({
		description: 'Array of tools for the MCP server',
		type: [ActivepiecesMcpToolDto],
		required: false
	})
	@IsArray()
	@ArrayNotEmpty()
	@ValidateNested({ each: true })
	@Type(() => ActivepiecesMcpToolDto)
	@IsOptional()
	readonly tools?: ActivepiecesMcpToolDto[];
}
