import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID } from 'class-validator';
import { ID, IIntegrationTenant } from '@gauzy/contracts';
import {
    ColumnIndex,
    IntegrationTenant,
    MultiORMManyToOne,
    TenantOrganizationBaseEntity
} from '@gauzy/core';
import {
    MultiORMEntity,
    MultiORMColumn
} from '@gauzy/core';
import { MikroOrmZapierWebhookSubscriptionRepository } from './mikro-orm-zapier.repository';
import { JoinColumn, RelationId } from 'typeorm';

@MultiORMEntity('zapier_webhook_subscriptions', {
    mikroOrmRepository: () => MikroOrmZapierWebhookSubscriptionRepository
})
export class ZapierWebhookSubscriptionRepository extends TenantOrganizationBaseEntity {
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
    @RelationId((it: ZapierWebhookSubscriptionRepository) => it.integration)
    @ColumnIndex()
    @MultiORMColumn({ nullable: true, relationId: true })
    integrationId!: ID;

    @MultiORMManyToOne(() => IntegrationTenant, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: true,

		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	integration!: IIntegrationTenant;
}
