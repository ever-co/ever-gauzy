import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ActivepiecesMcpToolDto {
	@ApiProperty({
		description: 'Tool ID',
		type: String,
		required: false
	})
	@IsString()
	@IsOptional()
	readonly id?: string;

	@ApiProperty({
		description: 'Tool type',
		type: String,
		required: false
	})
	@IsString()
	@IsOptional()
	readonly type?: string;

	@ApiProperty({
		description: 'Tool metadata',
		type: Object,
		required: false
	})
	@IsOptional()
	readonly pieceMetadata?: any;

	@ApiProperty({
		description: 'Flow ID associated with tool',
		type: String,
		required: false
	})
	@IsString()
	@IsOptional()
	readonly flowId?: string;
}

export class ActivepiecesMcpUpdateDto {
	@ApiProperty({
		description: 'MCP server name',
		type: String,
		required: false
	})
	@IsString()
	@IsOptional()
	readonly name?: string;

	@ApiProperty({
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