// External imports
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID } from 'class-validator';
import { JoinColumn, RelationId } from 'typeorm';
import { ID, IIntegrationTenant } from '@gauzy/contracts';
import {
	ColumnIndex,
	IntegrationTenant,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	TenantOrganizationBaseEntity
} from '@gauzy/core';
import { MikroOrmActivepiecesWebhookSubscriptionRepository } from './repository/mikro-orm-activepieces-webhook-subscription.repository';

@MultiORMEntity('zapier_webhook_subscription', {
	mikroOrmRepository: () => MikroOrmActivepiecesWebhookSubscriptionRepository
})
export class ActivepiecesWebhookSubscription extends TenantOrganizationBaseEntity {
	@ApiProperty({ type: () => String })
	@IsString()
	@ColumnIndex()
	@MultiORMColumn()
	targetUrl!: string;

	@ApiProperty({ type: () => String })
	@IsString()
	@ColumnIndex()
	@MultiORMColumn()
	events!: string;
	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/
	/**
	 * Integration Tenant
	 */
	@MultiORMManyToOne(() => IntegrationTenant, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: true,
		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	integration?: IIntegrationTenant;

	/**
	 * Integration Tenant ID
	 */
	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: ActivepiecesWebhookSubscription) => it.integration)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	integrationId!: ID;
}
