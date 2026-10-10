import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
	IsBoolean,
	IsEnum,
	IsInt,
	IsOptional,
	IsString,
	IsUUID,
	Min,
	MinLength,
	ValidateNested
} from 'class-validator';
import { ID, ISequenceCreateInput, SequenceResetPolicy } from '@gauzy/contracts';

/**
 * What a caller states when it opens a numbering series.
 *
 * **A series carries two kinds of member, and this body is where the difference starts.** Its
 * *configuration* is the shape of the numbers it produces — the key it is addressed by, the channel
 * that scopes it, the text placed before the number, its width, the increment each allocation applies
 * and when the series restarts. Its *state* is what it has already counted: `nextValue`, the value the
 * next document will be numbered with, and `lastResetAt`, the period it last restarted in. A create
 * states both, because a series has to start somewhere — and `nextValue` is stated here for the reason
 * an installation that adopts numbering an external system already stepped needs it: the counter it
 * must continue from.
 *
 * **`isActive` is not a member, and its absence is the contract.** A series that is created is a
 * series that numbers documents; retiring one is a move on a series that exists, not a property of a
 * new row, and it is stated through the edit — which is where an operator reaches for it once the
 * documents it numbered are no longer being issued.
 *
 * **No member is length-bounded here.** The delivered columns are unbounded in P0 and this programme
 * does not narrow them, so a bound invented at the surface would refuse a key or a prefix an
 * installation already numbers its documents by.
 */
export class CreateSequenceDTO implements ISequenceCreateInput {
	/**
	 * Series key, upper snake case, for example `ORDER` or `PURCHASE_ORDER`.
	 *
	 * The word every allocation resolves the series by: a domain asks for `ORDER` and is answered the
	 * counter this row holds.
	 */
	@ApiProperty({ type: () => String })
	@IsString()
	@MinLength(1)
	readonly key: string;

	/**
	 * The channel the counter belongs to, when the same key numbers documents per sales surface.
	 *
	 * Absent means the organization-wide series, which is also the fallback an allocation resolves a
	 * channel series' absence to — so an installation that numbers per channel declares one series per
	 * channel and needs no second key.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly channelId?: ID;

	/**
	 * Text placed before the number, for example `SO-`.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly prefix?: string;

	/**
	 * Minimum number of digits; shorter values are left-padded with zeroes.
	 */
	@ApiPropertyOptional({ type: () => Number, minimum: 0, default: 6 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(0)
	readonly padding?: number;

	/**
	 * The value the first allocation hands out.
	 *
	 * Stated when the series continues numbering an external system has already begun, and stated once:
	 * from here on the counter moves by allocating a number, because a counter written from outside the
	 * allocator is how two documents come to carry one number.
	 */
	@ApiPropertyOptional({ type: () => Number, minimum: 0, default: 1 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(0)
	readonly nextValue?: number;

	/**
	 * Increment applied per allocation.
	 *
	 * Larger than one when a range is reserved for an external system: the allocation hands out one
	 * value and advances by this much, so the values in between are the reserved block.
	 */
	@ApiPropertyOptional({ type: () => Number, minimum: 1, default: 1 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	readonly step?: number;

	/**
	 * When the series restarts.
	 *
	 * `NEVER` is the default and the honest one: a series that restarts is a decision about how an
	 * installation's documents are numbered, and a restart is the one move that hands out a value the
	 * series has handed out before.
	 */
	@ApiPropertyOptional({ type: () => String, enum: SequenceResetPolicy })
	@IsOptional()
	@IsEnum(SequenceResetPolicy)
	readonly resetPolicy?: SequenceResetPolicy;

	/**
	 * Free-text note for operators.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly description?: string;
}

/**
 * What a caller may change on a series that exists.
 *
 * **The members this body does not carry are the contract, and the reason is the difference between a
 * number and a counter.** A sequence row holds the value the *next* document will be numbered with, so
 * a body that could write it would renumber the installation's documents — silently, because a number
 * already printed on an invoice cannot be recalled and the only symptom is a duplicate the numbered
 * table refuses later. `key` and `channelId` are absent for the neighbouring reason: they are the
 * series' identity and the scope of its counter, and an edit that moved either would re-point a
 * counter at another sales surface's documents.
 *
 * `nextValue` and `lastResetAt` are therefore not members here, and — because a member the validation
 * pipe merely strips teaches a caller nothing — the route that binds this DTO refuses a body that
 * states one rather than dropping it. The counter moves by allocating a number, and backwards only
 * through the restart the series' own `resetPolicy` describes, which is an operation of its own.
 *
 * `isActive` **is** a member, and it is the retirement path: allocation refuses a series that is not
 * active (`BadRequestException`), so an operator who must stop numbering from a key — because the
 * documents moved to a new series, because an external system took the range over — sets this rather
 * than removing the row, which would leave every allocation for the key answered "no series is
 * configured" and a re-created series counting from one again.
 */
export class UpdateSequenceDTO {
	/**
	 * Text placed before the number, for example `SO-`.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly prefix?: string;

	/**
	 * Minimum number of digits; shorter values are left-padded with zeroes.
	 */
	@ApiPropertyOptional({ type: () => Number, minimum: 0 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(0)
	readonly padding?: number;

	/**
	 * Increment applied per allocation.
	 */
	@ApiPropertyOptional({ type: () => Number, minimum: 1 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	readonly step?: number;

	/**
	 * When the series restarts.
	 */
	@ApiPropertyOptional({ type: () => String, enum: SequenceResetPolicy })
	@IsOptional()
	@IsEnum(SequenceResetPolicy)
	readonly resetPolicy?: SequenceResetPolicy;

	/**
	 * Free-text note for operators.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly description?: string;

	/**
	 * Whether the series numbers documents at all.
	 *
	 * Retiring a series is this member and not a removal: the row and its counter stay, the allocation
	 * refuses with a reason, and the operator can put it back by stating `true`.
	 */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	readonly isActive?: boolean;
}

/**
 * The filterable members of the series list, in the flat spelling.
 */
export class SequenceFilterDTO {
	/**
	 * Restrict to the series one key names. An organization may hold one organization-wide series and
	 * one per channel under the same key, so this is the narrowing that answers "how is ORDER numbered
	 * here?".
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly key?: string;

	/**
	 * Restrict to the series that belong to one channel.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly channelId?: ID;
}

/**
 * The query of `GET /sequences`.
 *
 * Both spellings of the same filter are accepted: the flat one this platform's delivered list routes
 * are called with, and the bracketed one (`?filter[key]=ORDER`) the endpoint table names for the
 * resource. The bracketed members win when both are stated, because that is the spelling the
 * specification fixes.
 *
 * There is deliberately no page here: the endpoint table names no page for this resource, and a
 * numbering configuration is a handful of rows an operator reads whole rather than a ledger that is
 * walked. The GraphQL connection offers `page`, `limit` and `offset` over the same rows for a caller
 * that wants them.
 */
export class SequenceQueryDTO extends SequenceFilterDTO {
	/**
	 * The bracketed spelling of the same members.
	 */
	@ApiPropertyOptional({ type: () => SequenceFilterDTO })
	@IsOptional()
	@ValidateNested()
	@Type(() => SequenceFilterDTO)
	readonly filter?: SequenceFilterDTO;
}
