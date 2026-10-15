import { BadRequestException, Injectable, NotFoundException, OnModuleInit, Optional } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { EntityManager as MikroOrmEntityManager } from '@mikro-orm/core';
import { ID, IOutboxWriteInput } from '@gauzy/contracts';
import { RequestContext } from '../core/context/request-context';
import { MultiORMEnum, convertTypeORMWhereToMikroORM, getORMType } from '../core/utils';
import { EventOutboxService } from '../event-outbox/event-outbox.service';
import { declareStreamedEvents } from '../graphql/subscriptions/plugin-subscription';
import { SubscriptionCatalogue } from '../graphql/subscriptions/subscription-catalogue';
import { GraphqlSubscriptionConsumer } from '../graphql/subscriptions/subscription-consumer';
import { IntegrationTenant } from './integration-tenant.entity';
import { MikroOrmIntegrationTenantRepository } from './repository/mikro-orm-integration-tenant.repository';
import { TypeOrmIntegrationTenantRepository } from './repository/type-orm-integration-tenant.repository';

/**
 * The fact a connected integration appends when one of its synchronisations finishes.
 *
 * One name for every provider, because the fact is the platform's — "this connection finished synchronising" — and
 * the provider is in the payload (`name`), so a client follows every integration with one selection and narrows by
 * provider if it wants one.
 */
export const INTEGRATION_TENANT_SYNCED = 'integration_tenant.synced';

/**
 * The connection facts `Subscription.events` may select — today the one above — stated as a catalogue so the
 * subscription gate (`tools/scripts/subscription-parity-check.mjs`) reads the names this package streams.
 */
export const INTEGRATION_TENANT_STREAMED_EVENTS: readonly string[] = ['integration_tenant.synced'];

/** The aggregate every `integration_tenant.*` outbox row is written under. */
export const INTEGRATION_TENANT_AGGREGATE_TYPE = 'INTEGRATION_TENANT';

/**
 * What an integration states when its synchronisation finishes.
 */
export interface IIntegrationSyncCompletion {
	/**
	 * The tenant the connection belongs to. Defaults to the request's; a synchronisation that runs outside a request
	 * (a webhook-driven run, a job) states the tenant it was started for. With neither, nothing is written.
	 */
	readonly tenantId?: ID;
	/** The organization the connection belongs to, when the run knows it. Narrows the read; it is never widened. */
	readonly organizationId?: ID;
	/**
	 * How many records of each kind the run handled, keyed by the entity the integration synchronises (`issue`,
	 * `project`, `task`, `client`, `activity`, `screenshot`, …). Counts only: no record and no identifier travels.
	 */
	readonly counts?: Readonly<Record<string, number>>;
}

/**
 * Records that a connected integration finished synchronising: its `lastSyncedAt`, and the `integration_tenant.synced`
 * fact `Subscription.integrationSyncCompleted` follows, in one transaction.
 *
 * Every integration used to stamp the moment on its own (`IntegrationTenantService.update(id, { lastSyncedAt })`), or
 * not at all, and none announced it: there was no shared "sync completed" moment a client, a webhook or a
 * projection could follow (handover §7.68 class 5). Each integration's synchronisation now ends by calling
 * {@link recordSyncCompleted}, which writes both or neither: the column and the outbox row commit together, an append
 * that fails rolls the stamp back, and a connection the caller's tenant does not own is refused before anything is
 * written. The outbox consumer then publishes the fact on `integration_tenant.synced:<tenantId>`, the topic the
 * subscription opens.
 *
 * The name is declared with the subscription catalogue when the module starts, so `Subscription.events` may select
 * it too.
 */
@Injectable()
export class IntegrationTenantSyncService implements OnModuleInit {
	/**
	 * @param typeOrmIntegrationTenantRepository The connections, under TypeORM.
	 * @param mikroOrmIntegrationTenantRepository The connections, under MikroORM.
	 * @param outbox The platform outbox the fact is appended to.
	 * @param catalogue The events this installation streams.
	 * @param consumer The outbox consumer that feeds subscribers; absent where nothing serves them.
	 */
	constructor(
		private readonly typeOrmIntegrationTenantRepository: TypeOrmIntegrationTenantRepository,
		private readonly mikroOrmIntegrationTenantRepository: MikroOrmIntegrationTenantRepository,
		private readonly outbox: EventOutboxService,
		private readonly catalogue: SubscriptionCatalogue,
		@Optional() private readonly consumer?: GraphqlSubscriptionConsumer
	) {}

	/**
	 * Declares {@link INTEGRATION_TENANT_STREAMED_EVENTS}, and has the outbox consumer listen for them.
	 */
	onModuleInit(): void {
		declareStreamedEvents(this.catalogue, this.consumer, ...INTEGRATION_TENANT_STREAMED_EVENTS);
	}

	/**
	 * Stamps a connection as synchronised now and appends the fact, in one transaction.
	 *
	 * @param integrationTenantId The connection that finished synchronising.
	 * @param completion The tenant it belongs to, and what the run handled.
	 * @returns The connection as the stamp left it.
	 * @throws BadRequestException when no tenant is known, so the write could not be scoped.
	 * @throws NotFoundException when the connection is not the tenant's (or the organization's).
	 */
	async recordSyncCompleted(integrationTenantId: ID, completion: IIntegrationSyncCompletion = {}): Promise<IntegrationTenant> {
		const tenantId = completion.tenantId ?? RequestContext.currentTenantId();

		if (!integrationTenantId || !tenantId) {
			throw new BadRequestException(
				'INTEGRATION_SYNC_UNSCOPED: a synchronisation is recorded for one connection of one tenant, and neither may be left unstated.'
			);
		}

		const where = {
			id: integrationTenantId,
			tenantId,
			...(completion.organizationId ? { organizationId: completion.organizationId } : {})
		};
		const syncedAt = new Date();
		const counts = countsOf(completion.counts);

		return await this.transaction(async ({ findOne, update, manager }) => {
			const connection = await findOne(where);

			if (!connection) {
				throw new NotFoundException('The integration connection was not found.');
			}

			await update(where, { lastSyncedAt: syncedAt });

			await this.outbox.append(manager as never, {
				name: INTEGRATION_TENANT_SYNCED,
				aggregateType: INTEGRATION_TENANT_AGGREGATE_TYPE,
				aggregateId: integrationTenantId,
				data: {
					integrationTenantId,
					integrationId: connection.integrationId ?? null,
					name: connection.name,
					syncedAt,
					counts
				},
				tenantId,
				organizationId: connection.organizationId ?? completion.organizationId
			} as IOutboxWriteInput);

			return { ...connection, lastSyncedAt: syncedAt } as IntegrationTenant;
		});
	}

	/**
	 * Runs one write in a transaction on the ORM the installation runs, and hands it the reads and writes of the
	 * connection table and the manager the outbox appends through.
	 *
	 * @param work The transaction body.
	 * @returns What the body answers.
	 */
	private async transaction<R>(
		work: (transaction: {
			findOne: (where: Record<string, unknown>) => Promise<IntegrationTenant | null>;
			update: (where: Record<string, unknown>, patch: Partial<IntegrationTenant>) => Promise<void>;
			manager: EntityManager | MikroOrmEntityManager;
		}) => Promise<R>
	): Promise<R> {
		if (getORMType() === MultiORMEnum.MikroORM) {
			return await this.mikroOrmIntegrationTenantRepository.getEntityManager().transactional(
				async (em) =>
					await work({
						findOne: async (where) =>
							(await em.findOne(IntegrationTenant, convertTypeORMWhereToMikroORM(where as never), {
								disableIdentityMap: true
							} as never)) as IntegrationTenant | null,
						update: async (where, patch) => {
							await em.nativeUpdate(IntegrationTenant, convertTypeORMWhereToMikroORM(where as never), patch as never);
						},
						manager: em
					})
			);
		}

		return await this.typeOrmIntegrationTenantRepository.manager.transaction(
			async (manager) =>
				await work({
					findOne: async (where) => await manager.findOne(IntegrationTenant, { where: where as never }),
					update: async (where, patch) => {
						await manager.update(IntegrationTenant, where as never, patch as never);
					},
					manager
				})
		);
	}
}

/**
 * The counts a completion states, kept to whole non-negative numbers.
 *
 * The payload is what every subscriber and webhook of the tenant receives, so what a run hands over is reduced to
 * counts: a member that is not a finite number is dropped rather than forwarded.
 *
 * @param counts The counts the run stated.
 * @returns The counts.
 */
function countsOf(counts: Readonly<Record<string, number>> = {}): Record<string, number> {
	const kept: Record<string, number> = {};

	for (const [entity, count] of Object.entries(counts ?? {})) {
		if (typeof count === 'number' && Number.isFinite(count) && count >= 0) {
			kept[entity] = Math.floor(count);
		}
	}

	return kept;
}
