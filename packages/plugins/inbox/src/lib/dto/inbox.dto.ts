import { ApiPropertyOptional, PickType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
	IsBoolean,
	IsDate,
	IsEnum,
	IsInt,
	IsOptional,
	IsString,
	IsUUID,
	Max,
	MaxLength,
	Min,
	ValidateIf
} from 'class-validator';
import {
	ID,
	IInboxItemFindInput,
	IInboxRecipientStateInput,
	IInboxReplyInput,
	InboxItemKindEnum,
	InboxTabEnum
} from '@gauzy/contracts';

/** A query-string boolean (`true` / `false`); anything else is left as is for the validator to refuse. */
const toBoolean = ({ value }: { value: unknown }) => (value === 'true' ? true : value === 'false' ? false : value);

/** `GET /inbox/items` — the tab, the filters and the page. */
export class InboxItemQueryDTO implements IInboxItemFindInput {
	@ApiPropertyOptional({ enum: InboxTabEnum })
	@IsOptional()
	@IsEnum(InboxTabEnum)
	tab?: InboxTabEnum;

	@ApiPropertyOptional({ enum: InboxItemKindEnum })
	@IsOptional()
	@IsEnum(InboxItemKindEnum)
	kind?: InboxItemKindEnum;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(32)
	source?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	mailboxId?: ID;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@Transform(toBoolean)
	@IsBoolean()
	unread?: boolean;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(200)
	q?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	projectId?: ID;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	taskId?: ID;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	agentEmployeeId?: ID;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	cursor?: string;

	@ApiPropertyOptional({ type: () => Number, minimum: 1, maximum: 100 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(100)
	limit?: number;
}

/** `GET /inbox/items/counts` and `POST /inbox/items/mark-all-read`: an optional tab. */
export class InboxTabDTO {
	@ApiPropertyOptional({ enum: InboxTabEnum })
	@IsOptional()
	@IsEnum(InboxTabEnum)
	tab?: InboxTabEnum;
}

/**
 * `POST /inbox/items/mark-all-read`: an optional tab and the list's filters, so only the items the list shows are
 * marked read (review F65). The fields are the list query's own, so both routes accept the same values.
 */
export class InboxMarkAllReadDTO extends PickType(InboxItemQueryDTO, ['tab', 'kind', 'source', 'q'] as const) {}

/** `POST /inbox/items/:id/reply`. */
export class InboxReplyDTO implements IInboxReplyInput {
	@ApiPropertyOptional({ type: () => String, maxLength: 10000 })
	@IsOptional()
	@IsString()
	@MaxLength(10000)
	text?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(100)
	optionId?: string;
}

/** `PATCH /inbox/items/:id/state`. */
export class InboxStateDTO implements IInboxRecipientStateInput {
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	isRead?: boolean;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	isArchived?: boolean;

	/** A date-time to snooze until, or `null` to un-snooze. */
	@ApiPropertyOptional({ type: () => String, format: 'date-time', nullable: true })
	@IsOptional()
	@ValidateIf((dto: InboxStateDTO) => dto.snoozedUntil !== null)
	@Type(() => Date)
	@IsDate()
	snoozedUntil?: Date | null;
}
