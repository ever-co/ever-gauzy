import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, Min, IsInt } from 'class-validator';
import { Transform } from 'class-transformer';

export class ListMcpServersDto {
	@ApiPropertyOptional({
		description:
			"ActivePieces project ID. Required with the tenant's own API key; in the project-token and platform-project " +
			"modes the server uses the tenant's own project, and another one is refused.",
		type: String,
		example: 'project-123'
	})
	@IsOptional()
	@IsString()
	@IsNotEmpty()
	@Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
	readonly projectId?: string;

	@ApiPropertyOptional({
		description: 'Number of results to return',
		type: Number,
		minimum: 1,
		example: 10
	})
	@IsOptional()
	@IsInt()
	@Min(1)
	@Transform(({ value }) => parseInt(value, 10))
	readonly limit?: number;

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
		description: 'Filter by MCP server name',
		type: String,
		example: 'my-mcp-server'
	})
	@IsOptional()
	@IsString()
	@Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
	readonly name?: string;
}
