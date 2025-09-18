import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsNumber, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export class ListMcpServersDto {
	@ApiProperty({
		description: 'ActivePieces project ID',
		type: String,
		example: 'project-123'
	})
	@IsString()
	@IsNotEmpty()
	readonly projectId!: string;

	@ApiProperty({
		description: 'Number of results to return',
		type: Number,
		required: false,
		minimum: 1,
		example: 10
	})
	@IsOptional()
	@IsNumber()
	@Min(1)
	@Transform(({ value }) => parseInt(value, 10))
	readonly limit?: number;

	@ApiProperty({
		description: 'Pagination cursor',
		type: String,
		required: false,
		example: 'cursor-abc123'
	})
	@IsOptional()
	@IsString()
	readonly cursor?: string;

	@ApiProperty({
		description: 'Filter by MCP server name',
		type: String,
		required: false,
		example: 'my-mcp-server'
	})
	@IsOptional()
	@IsString()
	readonly name?: string;
}