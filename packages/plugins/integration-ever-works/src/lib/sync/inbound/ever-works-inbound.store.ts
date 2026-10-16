import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { ID } from '@gauzy/contracts';
import { IntegrationTenant } from '@gauzy/core';
import type { EverWorksEventEnvelope } from '../../client/ever-works-client.types';
import { EverWorksConnection } from '../../connection/ever-works-connection.entity';
import { EVER_WORKS_INTEGRATION_NAME } from '../../ever-works.constants';
import { EverWorksSettingName } from '../../ever-works-setting.enum';
import { EverWorksInboundEvent, EverWorksInboundStatus } from '../entities/ever-works-sync.entities';

/**
 * Stores Ever Works events as they arrive (webhook, change feed, initial sync), deduplicated on the event
 * id per connection. The tenant is the connection's; the organization is the Gauzy organization mapped
 * to the event's Ever Works organization, never anything the payload claims.
 */
@Injectable()
export class EverWorksInboundStore {
	constructor(private readonly dataSource: DataSource) {}

	/** Stores the event once; `duplicate` when the connection already has it. */
	async record(connection: EverWorksConnection, envelope: EverWorksEventEnvelope, via: 'webhook' | 'feed' | 'initial'): Promise<{ duplicate: boolean }> {
		const repository = this.dataSource.getRepository(EverWorksInboundEvent);
		const exists = await repository.count({ where: { connectionId: connection.id as ID, eventId: envelope.id } });
		if (exists) return { duplicate: true };
		const organizationId = envelope.organizationId ? await this.organizationFor(connection, envelope.organizationId) : null;
		const id = randomUUID();
		await repository
			.createQueryBuilder()
			.insert()
			.into(EverWorksInboundEvent)
			.values({
				id,
				tenantId: connection.tenantId,
				organizationId: organizationId ?? undefined,
				connectionId: connection.id as ID,
				eventId: envelope.id,
				seq: envelope.seq,
				type: envelope.type,
				aggregateType: envelope.aggregate.type,
				aggregateId: envelope.aggregate.id,
				aggregateVersion: envelope.aggregate.version ?? null,
				ewOrganizationId: envelope.organizationId ?? null,
				payload: JSON.stringify(envelope),
				receivedVia: via,
				status: EverWorksInboundStatus.PENDING,
				attempts: 0,
				availableAt: new Date()
			} as never)
			.orIgnore()
			.execute();
		// A webhook delivery and the feed can race past the check above; the unique (connection, event)
		// index keeps one row, and the row that is there tells which insert won (drivers report an ignored
		// insert differently, the stored id does not).
		const stored = await repository.findOne({ where: { connectionId: connection.id as ID, eventId: envelope.id }, select: { id: true } });
		return { duplicate: stored?.id !== id };
	}

	/** The Gauzy organization mapped to an Ever Works organization through this connection, or `null`. */
	async organizationFor(connection: EverWorksConnection, everWorksOrganizationId: string): Promise<ID | null> {
		const mappings = await this.dataSource.getRepository(IntegrationTenant).find({
			where: { tenantId: connection.tenantId, name: EVER_WORKS_INTEGRATION_NAME, isActive: true, isArchived: false },
			relations: { settings: true }
		});
		const setting = (row: IntegrationTenant, name: EverWorksSettingName) => row.settings?.find((s) => s.settingsName === name)?.settingsValue;
		const mapping = mappings.find(
			(row) => setting(row, EverWorksSettingName.CONNECTION_ID) === connection.id && setting(row, EverWorksSettingName.EVER_WORKS_ORGANIZATION_ID) === everWorksOrganizationId
		);
		return (mapping?.organizationId as ID) ?? null;
	}
}
