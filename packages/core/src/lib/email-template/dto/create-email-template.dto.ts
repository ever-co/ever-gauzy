import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { ID, LanguagesEnum } from '@gauzy/contracts';
import { IsOrganizationBelongsToUser } from './../../shared/validators';

/**
 * Create email template request DTO.
 *
 * The tenant is always the caller's own and is set by the controller, never taken from the body
 * (GHSA-44pv-34gx-q9p4) — so no tenant field is declared here, and the controller strips the scope
 * fields from the payload before it reaches the service.
 *
 * `name`, `languageCode` and `hbs` are `NOT NULL` on `email_template` (see `1638541848595-SwitchToMigration`),
 * so a create that omits one could never have persisted; declaring them turns the resulting database
 * error into a 400 and lets Swagger publish the real create schema, which the inherited route never did.
 */
export class CreateEmailTemplateDTO {
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	readonly name: string;

	@ApiProperty({ type: () => String, enum: LanguagesEnum })
	@IsNotEmpty()
	@IsString()
	readonly languageCode: LanguagesEnum;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly mjml?: string;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	readonly hbs: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@IsOrganizationBelongsToUser()
	readonly organizationId?: ID;
}
