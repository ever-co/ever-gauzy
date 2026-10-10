import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import { ID } from '@gauzy/contracts';

/** A report's slug: lowercase words joined by single hyphens, which is how the seeded catalogue spells them. */
export const REPORT_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * The body of `POST /report`: one entry of the platform-wide report catalogue.
 *
 * The catalogue is global reference data — no tenant column — so the route is gated to `SUPER_ADMIN` and
 * the entry is offered to every organization's menu, where each organization still switches it on or off
 * for itself. `showInMenu` is not a member: it is computed per organization from the menu rows.
 */
export class CreateReportDTO {
	@ApiProperty({ type: () => String, maxLength: 255 })
	@IsNotEmpty()
	@IsString()
	@MaxLength(255)
	readonly name: string;

	@ApiProperty({ type: () => String, maxLength: 255, example: 'time-and-activity' })
	@IsNotEmpty()
	@IsString()
	@MaxLength(255)
	@Matches(REPORT_SLUG_PATTERN, { message: 'slug must be lowercase words joined by single hyphens.' })
	readonly slug: string;

	@ApiPropertyOptional({ type: () => String, maxLength: 255 })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	readonly description?: string;

	@ApiPropertyOptional({ type: () => String, maxLength: 255 })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	readonly image?: string;

	@ApiPropertyOptional({ type: () => String, maxLength: 255 })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	readonly iconClass?: string;

	@ApiProperty({ type: () => String, format: 'uuid' })
	@IsUUID()
	readonly categoryId: ID;
}

/** The body of `POST /report/category`: one heading of the platform-wide report catalogue. */
export class CreateReportCategoryDTO {
	@ApiProperty({ type: () => String, maxLength: 255 })
	@IsNotEmpty()
	@IsString()
	@MaxLength(255)
	readonly name: string;

	@ApiPropertyOptional({ type: () => String, maxLength: 255 })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	readonly iconClass?: string;
}

/** The body of `PUT /report/category/:id`: the members to change; a member left out is left as it is. */
export class UpdateReportCategoryDTO extends PartialType(CreateReportCategoryDTO) {}
