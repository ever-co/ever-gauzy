import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, TransformFnParams, Type } from 'class-transformer';
import {
	IsArray,
	IsBoolean,
	IsDate,
	IsEnum,
	IsInt,
	IsOptional,
	IsUUID,
	Max,
	Min,
	ValidateNested
} from 'class-validator';
import { ContactGroupSource, ID } from '@gauzy/contracts';
import { parseToBoolean } from '@gauzy/utils';

/**
 * One party joining a group, as a membership write states it.
 *
 * The provenance is absent on purpose: a hand-written membership is `MANUAL`, and the two derived
 * kinds belong to the operations that own them — the segment materialiser and the import — so a body
 * that claimed one of them would be claiming somebody else's provenance.
 */
export class GroupMemberAddDTO {
	/**
	 * The party to make a member.
	 */
	@ApiProperty({ type: () => String })
	@IsUUID()
	readonly contactId: ID;

	/**
	 * When the membership lapses. Omitted means it does not lapse. Must be in the future when stated:
	 * a membership granted until yesterday grants nothing, and writing it would tell the caller it had
	 * granted something.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@Type(() => Date)
	@IsDate()
	readonly expiresAt?: Date;
}

/**
 * One party leaving a group, and which of its memberships is meant.
 *
 * The provenance is part of the request because removal is scoped by it: an operator removes the
 * hand-written membership and never the derived row an evaluation owns.
 */
export class GroupMemberRemoveDTO {
	/**
	 * The party whose membership is removed.
	 */
	@ApiProperty({ type: () => String })
	@IsUUID()
	readonly contactId: ID;

	/**
	 * Which membership row is meant. Defaults to the hand-written one.
	 */
	@ApiPropertyOptional({ type: () => String, enum: ContactGroupSource })
	@IsOptional()
	@IsEnum(ContactGroupSource)
	readonly source?: ContactGroupSource;
}

/**
 * The membership write the endpoint table describes: `add[]` and `remove[]` in one call.
 *
 * A patch rather than a replacement, because the delivered service offers exactly the two operations
 * this body states: the parties named in `remove` lose the membership of the stated provenance and the
 * parties named in `add` join by hand. The removals are applied first, so "this member's window
 * changes" is one call — remove the lapsed membership, add it back with the new instant — which is the
 * pair that would otherwise need two requests and could half-apply between them.
 *
 * The whole `add` list is validated by the service before any of it is written, so a list naming a
 * party twice, or one that already holds a live membership, is refused as a whole rather than
 * half-applied.
 */
export class ReplaceGroupMembersDTO {
	/**
	 * The parties joining the group.
	 */
	@ApiPropertyOptional({ type: () => [GroupMemberAddDTO] })
	@IsOptional()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => GroupMemberAddDTO)
	readonly add?: GroupMemberAddDTO[];

	/**
	 * The parties leaving it.
	 */
	@ApiPropertyOptional({ type: () => [GroupMemberRemoveDTO] })
	@IsOptional()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => GroupMemberRemoveDTO)
	readonly remove?: GroupMemberRemoveDTO[];
}

/**
 * The narrowing members of the membership list, in the flat spelling.
 */
export class GroupMemberFilterDTO {
	/**
	 * Restrict to one provenance.
	 */
	@ApiPropertyOptional({ type: () => String, enum: ContactGroupSource })
	@IsOptional()
	@IsEnum(ContactGroupSource)
	readonly source?: ContactGroupSource;

	/**
	 * Include rows whose window has passed.
	 *
	 * Off by default, because an expired membership is absent as far as every reader is concerned; an
	 * administrative listing turns it on to see what the cleanup job has not removed yet.
	 */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@Transform(({ value }: TransformFnParams) => parseToBoolean(value))
	@IsBoolean()
	readonly includeExpired?: boolean;
}

/**
 * The query of `GET /contact-groups/:id/members`.
 *
 * Both spellings of the same filter are accepted, as on every list route of this platform: the flat
 * one, and the bracketed one (`?filter[source]=MANUAL`) the endpoint table's sibling rows use.
 */
export class ContactGroupMemberQueryDTO extends GroupMemberFilterDTO {
	/**
	 * The bracketed spelling of the same members.
	 */
	@ApiPropertyOptional({ type: () => GroupMemberFilterDTO })
	@IsOptional()
	@ValidateNested()
	@Type(() => GroupMemberFilterDTO)
	readonly filter?: GroupMemberFilterDTO;

	/**
	 * How many memberships to answer with.
	 */
	@ApiPropertyOptional({ type: () => Number, minimum: 1, maximum: 100 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(100)
	readonly take?: number;

	/**
	 * How many memberships to skip.
	 */
	@ApiPropertyOptional({ type: () => Number, minimum: 0 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(0)
	readonly skip?: number;
}
