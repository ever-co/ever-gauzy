import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNotEmpty, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * The body of `POST /integration/activepieces/mcp`: a new MCP server of the legacy API
 * (`GAUZY_ACTIVEPIECES_MCP_API=legacy`), which Activepieces creates from a name, in the project.
 */
export class ActivepiecesMcpCreateDto {
	@ApiProperty({
		description: 'MCP server name',
		type: String,
		required: true
	})
	@IsString()
	@IsNotEmpty()
	@MaxLength(255)
	@Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
	readonly name!: string;

	@ApiPropertyOptional({
		description:
			'An agent to link the server to. Activepieces creates an MCP server from its name alone, so a request ' +
			'that names an agent is refused rather than answered with a server that has none.',
		type: String,
		required: false
	})
	@IsString()
	@IsOptional()
	@Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
	readonly agentId?: string;
}
