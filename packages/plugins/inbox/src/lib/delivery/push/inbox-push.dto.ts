import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsObject, IsOptional, IsString, Matches, MaxLength, Min, ValidateIf, ValidateNested } from 'class-validator';
import { IInboxPushSubscriptionInput } from '@gauzy/contracts';
import { INBOX_PUSH_ENDPOINT_MAX, INBOX_PUSH_KEY_MAX } from './inbox-push.constants';

/** The device's keys, as `PushSubscription.toJSON().keys` gives them. */
export class InboxPushSubscriptionKeysDTO {
	@ApiProperty({ type: () => String })
	@IsString()
	@MaxLength(INBOX_PUSH_KEY_MAX)
	p256dh!: string;

	@ApiProperty({ type: () => String })
	@IsString()
	@MaxLength(INBOX_PUSH_KEY_MAX)
	auth!: string;
}

/** `POST /inbox/push-subscriptions`: the browser's `PushSubscription.toJSON()`, plus the device's name for the list. */
export class InboxPushSubscribeDTO implements IInboxPushSubscriptionInput {
	@ApiProperty({ type: () => String, description: 'The push service endpoint (https)' })
	@IsString()
	@MaxLength(INBOX_PUSH_ENDPOINT_MAX)
	@Matches(/^https:\/\//, { message: 'endpoint must be an https URL' })
	endpoint!: string;

	@ApiProperty({ type: () => InboxPushSubscriptionKeysDTO })
	@IsObject()
	@ValidateNested()
	@Type(() => InboxPushSubscriptionKeysDTO)
	keys!: InboxPushSubscriptionKeysDTO;

	@ApiPropertyOptional({ type: () => Number, nullable: true, description: 'Epoch milliseconds, as the browser gives it' })
	@IsOptional()
	@ValidateIf((it) => it.expirationTime !== null)
	@IsInt()
	@Min(0)
	expirationTime?: number | null;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	userAgent?: string | null;
}
