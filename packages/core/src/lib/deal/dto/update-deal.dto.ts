import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, Min, ValidateIf } from 'class-validator';
import { ID } from '@gauzy/contracts';

/**
 * Update deal DTO.
 *
 * An edit may state any subset of the deal's own facts (moving a deal on the board sends only `stageId`),
 * so every member may be left out; but a member that IS sent carries the same rules a create applies to it:
 * a non-empty title, a whole-number probability from 0 to 5, UUIDs for the stage and the client.
 *
 * `title`, `probability` and `stageId` are required columns, so only an omitted member (`undefined`) skips
 * validation: an explicit `null` is refused here rather than failing later at the database. `clientId` is
 * the one nullable column, so `null` stays valid there and unassigns the client.
 *
 * Only the deal's own columns are declared. The tenant and organization scope members are not: they are
 * resolved by the guards and the service, and the route validates this DTO without stripping, so they
 * pass through untouched.
 */
export class UpdateDealDTO {
	@ApiPropertyOptional({ type: () => String })
	@ValidateIf((it: UpdateDealDTO) => it.title !== undefined)
	@IsNotEmpty()
	@IsString()
	title?: string;

	@ApiPropertyOptional({ type: () => Number })
	@ValidateIf((it: UpdateDealDTO) => it.probability !== undefined)
	@IsInt()
	@Min(0)
	@Max(5)
	probability?: number;

	@ApiPropertyOptional({ type: () => String })
	@ValidateIf((it: UpdateDealDTO) => it.stageId !== undefined)
	@IsUUID()
	stageId?: ID;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	clientId?: ID | null;
}
