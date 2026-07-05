import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { MAKE_COM_ZONES, MakeComZone } from '../interfaces/make-com-api.model';

/**
 * DTO for the "set zone" endpoint.
 *
 * The zone is string-interpolated into the Make.com API hostname (`https://${zone}.make.com/...`),
 * so it MUST be constrained to the known allowlist at runtime — `@IsIn(MAKE_COM_ZONES)` — to prevent
 * host-injection SSRF (GHSA-vcwx-qh95-54g6). The compile-time `MakeComZone` union is erased at
 * runtime and is not sufficient on its own.
 */
export class SetZoneDTO {
	@ApiProperty({
		enum: MAKE_COM_ZONES,
		description: 'The Make.com zone that determines the API base URL',
		example: 'us2'
	})
	@IsIn(MAKE_COM_ZONES)
	zone: MakeComZone;

	@ApiPropertyOptional({ type: String, description: 'Optional Gauzy organization ID' })
	@IsOptional()
	@IsUUID()
	organizationId?: string;
}
