import { Entity, Column } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID } from 'class-validator';
import { ColumnIndex, TenantOrganizationBaseEntity } from '@gauzy/core';
import { MultiORMEntity, MultiORMColumn } from '@gauzy/core';
import { MikroOrmZapierWebhookSubscriptionRepository } from './mikro-orm-zapier.repository';

@MultiORMEntity('zapier_webhook_subscriptions', {
	mikroOrmRepository: () => MikroOrmZapierWebhookSubscriptionRepository
})
export class ZapierWebhookSubscription extends TenantOrganizationBaseEntity {
	@ApiProperty({ type: () => String })
	@IsString()
  @ColumnIndex()
	@MultiORMColumn()
	targetUrl!: string;

	@ApiProperty({ type: () => String })
	@IsString()
  @ColumnIndex()
	@MultiORMColumn()
	event!: string;

	@ApiProperty({ type: () => String })
	@IsUUID()
  @ColumnIndex()
	@MultiORMColumn()
	integrationId!: string;
}
