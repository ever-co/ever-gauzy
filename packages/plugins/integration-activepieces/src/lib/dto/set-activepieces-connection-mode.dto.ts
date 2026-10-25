import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ActivepiecesConnectionMode } from '@gauzy/contracts';

/**
 * DTO for choosing how the tenant reaches Activepieces (`POST /integration/activepieces/connection-mode`).
 *
 * `organizationId` only selects which of the tenant's existing integration rows the choice is saved on: it is matched
 * against the tenant's own rows, and no row is created for an organization (the tenant-level row is).
 */
export class SetActivepiecesConnectionModeDto {
	@ApiProperty({
		description:
			"How the tenant reaches Activepieces: 'auto' (own key, else project token, else the installation's key " +
			"pinned to the tenant's own project), 'tenant_api_key', 'project_token' or 'platform_project'.",
		enum: ActivepiecesConnectionMode,
		example: ActivepiecesConnectionMode.AUTO
	})
	@IsEnum(ActivepiecesConnectionMode)
	readonly mode!: ActivepiecesConnectionMode;

	@ApiPropertyOptional({
		description: "The organization whose Activepieces integration the choice is for (the tenant's when omitted)",
		type: String,
		format: 'uuid'
	})
	@IsOptional()
	@IsUUID()
	readonly organizationId?: string;
}
