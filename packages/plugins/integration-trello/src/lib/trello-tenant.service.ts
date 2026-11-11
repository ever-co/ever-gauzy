import { BadRequestException, Inject, Injectable, InternalServerErrorException, Logger, NotFoundException, Optional } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ID, IInboxItemWriter, IIntegrationSetting, IIntegrationTenant, INBOX_ITEM_WRITER, IntegrationEntity } from '@gauzy/contracts';
import { Integration, INTEGRATION_MANAGERS_LIMIT, IntegrationSettingService, IntegrationTenantService, IntegrationTenantUpdateOrCreateCommand, RequestContext } from '@gauzy/core';
import { TrelloApiClient, TrelloMember } from './client/trello-api.client';
import { ATTENTION_NOTICE_DEFERRED, attentionItemOf } from './trello-attention';
import { TrelloConfig } from './trello-config';
import { TRELLO_CONFIG, TRELLO_INTEGRATION_NAME, TRELLO_NOT_CONFIGURED, TRELLO_NOT_CONNECTED, TrelloSettingName } from './trello.constants';

/** The settings of a connection as a map (`settingsName` → `settingsValue`). */
export type TrelloSettings = Partial<Record<TrelloSettingName, string>>;

/** What the routes answer about a connection (never the token). */
export interface TrelloConnectionSummary {
	id: ID;
	organizationId: ID;
	trelloMemberId: string | null;
	trelloMemberUsername: string | null;
	trelloMemberName: string | null;
	connectedByUserId: string | null;
	attentionReason: string | null;
	lastSyncedAt: Date | null;
	createdAt: Date | null;
}

/**
 * The connected organizations: each is an `integration_tenant` named `Trello` whose settings hold the member token
 * and the Trello member it belongs to. The token is written only here and read only by {@link clientFor}; no route
 * answers it. Trello's tokens do not expire (they are handed out with `expiration=never`); one a person revoked is
 * refused by Trello, and the connection then asks for a person.
 */
@Injectable()
export class TrelloTenantService {
	private readonly logger = new Logger(TrelloTenantService.name);

	constructor(
		private readonly commandBus: CommandBus,
		private readonly integrationTenantService: IntegrationTenantService,
		private readonly integrationSettingService: IntegrationSettingService,
		@Inject(TRELLO_CONFIG) private readonly config: TrelloConfig,
		/** The Inbox, when its plugin is loaded: the person who connected and the integration's managers hear there of a refused token. */
		@Optional() @Inject(INBOX_ITEM_WRITER) private readonly inbox?: IInboxItemWriter | null
	) {}

	/** The connection of an organization in the current tenant, with its settings, or null. */
	async forOrganization(organizationId: ID, tenantId: ID = RequestContext.currentTenantId() as ID): Promise<IIntegrationTenant | null> {
		if (!tenantId || !organizationId) return null;
		return this.integrationTenantService
			.findOneByOptions({
				where: { name: TRELLO_INTEGRATION_NAME, tenantId, organizationId, isActive: true, isArchived: false },
				relations: { settings: true },
				order: { createdAt: 'DESC' }
			})
			.catch(() => null);
	}

	/** A connection by id, in the current tenant, with its settings; 404 otherwise. */
	async requireById(integrationId: ID): Promise<IIntegrationTenant> {
		const tenantId = RequestContext.currentTenantId();
		const tenant = await this.integrationTenantService
			.findOneByIdString(integrationId, {
				where: { name: TRELLO_INTEGRATION_NAME, tenantId: tenantId as ID, isActive: true, isArchived: false },
				relations: { settings: true }
			})
			.catch(() => null);
		if (!tenant) {
			throw new NotFoundException({ message: 'The Trello connection was not found', code: TRELLO_NOT_CONNECTED });
		}
		return tenant;
	}

	/** A connection by id regardless of the request (a webhook has no tenant): with its settings, or null. */
	async findAnyById(integrationId: ID): Promise<IIntegrationTenant | null> {
		return this.integrationTenantService['typeOrmRepository']
			.findOne({ where: { id: integrationId, name: TRELLO_INTEGRATION_NAME, isActive: true, isArchived: false } as never, relations: { settings: true } as never })
			.catch((error: unknown) => {
				// A connection the store could not read is not a missing one, but the caller can do no more with it either.
				this.logger.warn(`Connection ${integrationId} could not be read: ${error instanceof Error ? error.message : String(error)}`);
				return null;
			}) as Promise<IIntegrationTenant | null>;
	}

	settingsOf(tenant: IIntegrationTenant): TrelloSettings {
		const result: TrelloSettings = {};
		for (const setting of tenant.settings ?? []) {
			if (setting.settingsName) result[setting.settingsName as TrelloSettingName] = setting.settingsValue ?? undefined;
		}
		return result;
	}

	summaryOf(tenant: IIntegrationTenant): TrelloConnectionSummary {
		const settings = this.settingsOf(tenant);
		return {
			id: tenant.id as ID,
			organizationId: tenant.organizationId as ID,
			trelloMemberId: settings[TrelloSettingName.TRELLO_MEMBER_ID] ?? null,
			trelloMemberUsername: settings[TrelloSettingName.TRELLO_MEMBER_USERNAME] ?? null,
			trelloMemberName: settings[TrelloSettingName.TRELLO_MEMBER_NAME] ?? null,
			connectedByUserId: settings[TrelloSettingName.CONNECTED_BY_USER_ID] ?? null,
			attentionReason: settings[TrelloSettingName.ATTENTION_REASON] || null,
			lastSyncedAt: (tenant as { lastSyncedAt?: Date }).lastSyncedAt ?? null,
			createdAt: (tenant as { createdAt?: Date }).createdAt ?? null
		};
	}

	/** The API client of a connection; 400 `TRELLO_NOT_CONNECTED` when it holds no token, `TRELLO_NOT_CONFIGURED` without the key. */
	clientFor(tenant: IIntegrationTenant): TrelloApiClient {
		if (!this.config.apiKey) {
			throw new BadRequestException({ message: 'The Trello application key is not configured on this server', code: TRELLO_NOT_CONFIGURED });
		}
		const token = this.settingsOf(tenant)[TrelloSettingName.TOKEN];
		if (!token) {
			throw new BadRequestException({ message: 'The Trello connection holds no token', code: TRELLO_NOT_CONNECTED });
		}
		return new TrelloApiClient(this.config.apiKey, token, { apiUrl: this.config.apiUrl });
	}

	/** A client for a token not stored yet (the connect flow checks it with Trello before saving it). */
	clientForToken(token: string): TrelloApiClient {
		if (!this.config.apiKey) {
			throw new BadRequestException({ message: 'The Trello application key is not configured on this server', code: TRELLO_NOT_CONFIGURED });
		}
		return new TrelloApiClient(this.config.apiKey, token, { apiUrl: this.config.apiUrl });
	}

	/** Records (or renews) the connection of an organization with a checked token and the Trello member it belongs to. */
	async connect(scope: { tenantId: ID; organizationId: ID; userId?: ID | null }, token: string, member: TrelloMember): Promise<IIntegrationTenant> {
		const { tenantId, organizationId } = scope;
		// The connection this one replaces, if any: a refusal it carried is over once the new token is stored.
		const replaced = await this.forOrganization(organizationId, tenantId);
		const wasRefused = !!(replaced && this.settingsOf(replaced)[TrelloSettingName.ATTENTION_REASON]);
		const previousUserId = (replaced && this.settingsOf(replaced)[TrelloSettingName.CONNECTED_BY_USER_ID]) || null;
		const integration = await this.integrationTenantService['typeOrmRepository'].manager.findOne(Integration, { where: { name: TRELLO_INTEGRATION_NAME } });
		if (!integration) {
			throw new NotFoundException({ message: 'The Trello integration is not in the catalogue', code: TRELLO_NOT_CONNECTED });
		}
		const settings = [
			[TrelloSettingName.TOKEN, token],
			[TrelloSettingName.TRELLO_MEMBER_ID, member.id],
			[TrelloSettingName.TRELLO_MEMBER_USERNAME, member.username],
			[TrelloSettingName.TRELLO_MEMBER_NAME, member.fullName],
			[TrelloSettingName.CONNECTED_BY_USER_ID, scope.userId ? String(scope.userId) : ''],
			[TrelloSettingName.ATTENTION_REASON, '']
		].map(([settingsName, settingsValue]) => ({ settingsName, settingsValue, tenantId, organizationId }));
		const entitySettings = [IntegrationEntity.PROJECT, IntegrationEntity.TASK, IntegrationEntity.LABEL].map((entity) => ({ entity, sync: true, tenantId, organizationId }));
		const written: IIntegrationTenant = await this.commandBus.execute(
			new IntegrationTenantUpdateOrCreateCommand(
				{ name: TRELLO_INTEGRATION_NAME, integration: { provider: TRELLO_INTEGRATION_NAME }, tenantId, organizationId },
				{ name: TRELLO_INTEGRATION_NAME, integration, tenantId, organizationId, entitySettings, settings, isActive: true, isArchived: false } as never
			)
		);
		// The platform's settings writer reports a failed write instead of raising it: the token is read back, and a
		// connection whose token is not the one just handed over is not answered as connected.
		const stored = await this.findAnyById(written.id as ID);
		if (!stored || this.settingsOf(stored)[TrelloSettingName.TOKEN] !== token) {
			throw new InternalServerErrorException({ message: 'The Trello connection could not be stored; connect again', code: TRELLO_NOT_CONNECTED });
		}
		// The notice went to whoever connected before: they hear of the resolution too, whoever reconnected.
		if (wasRefused) await this.fileAttention(stored, null, previousUserId ? [previousUserId as ID] : []);
		return stored;
	}

	/**
	 * Records why the connection needs a person (a refused token), or clears it — and tells the person who connected
	 * and the organization's integration managers in their Inbox, once per refusal (the item is keyed by the
	 * connection) and once more when it works again.
	 */
	async setAttention(tenant: IIntegrationTenant, reason: string | null, refusedToken?: string | null): Promise<void> {
		// A refusal names the token it was for: when the row holds another one by now (reconnected meanwhile), the
		// refusal is stale and the connection is left alone; a real refusal of the new token marks it on its next use.
		if (reason && refusedToken) {
			const current = await this.findAnyById(tenant.id as ID);
			const stored = current ? this.settingsOf(current)[TrelloSettingName.TOKEN] : null;
			if (current && stored && stored !== refusedToken) {
				this.logger.log(`Connection ${tenant.id}: the refused token is not the stored one any more; not marked.`);
				return;
			}
		}
		const settings = this.settingsOf(tenant);
		const before = settings[TrelloSettingName.ATTENTION_REASON] || null;
		const noticed = !!settings[TrelloSettingName.ATTENTION_NOTICE_AT] && settings[TrelloSettingName.ATTENTION_NOTICE_AT] !== ATTENTION_NOTICE_DEFERRED;
		try {
			await this.writeSetting(tenant, TrelloSettingName.ATTENTION_REASON, reason ?? '');
		} catch (error) {
			// Not filed either: the Inbox must not say the imports are paused while the sweep still runs them.
			this.logger.warn(`The attention reason of connection ${tenant.id} could not be written: ${(error as Error).message}`);
			return;
		}
		// A new refusal is not filed until its own filing records it: the timestamp an earlier refusal left (a resolution
		// whose filing failed) is cleared first, so every way the filing below can stop leaves it to the sweep.
		if (reason && before !== reason && settings[TrelloSettingName.ATTENTION_NOTICE_AT]) {
			try {
				await this.writeSetting(tenant, TrelloSettingName.ATTENTION_NOTICE_AT, '');
			} catch (error) {
				this.logger.warn(`The filing timestamp of connection ${tenant.id} could not be cleared: ${(error as Error).message}`);
			}
		}
		// Filed when the reason changed — and again when an earlier filing (or resolution) did not get through: the
		// item is keyed by the connection, so a second filing updates it rather than adding one.
		const changed = reason ? before !== reason : !!before;
		const pending = reason ? !noticed : noticed;
		if (changed || pending) await this.fileAttention(tenant, reason);
	}

	/**
	 * Files the notice of a refused connection whose filing did not get through (no `ATTENTION_NOTICE_AT`): the
	 * scheduled sweep calls it for every refused connection it leaves alone, so the retry is durable — every five
	 * minutes until the Inbox took it — and does not wait for the next refusal.
	 */
	async ensureAttentionFiled(tenant: IIntegrationTenant): Promise<void> {
		const settings = this.settingsOf(tenant);
		const reason = settings[TrelloSettingName.ATTENTION_REASON] || null;
		const noticeAt = settings[TrelloSettingName.ATTENTION_NOTICE_AT] || '';
		if (!reason || (noticeAt && noticeAt !== ATTENTION_NOTICE_DEFERRED)) return;
		// A deferred notice was never filed: its first filing re-surfaces it; a retry of a filing taken does not.
		await this.fileAttention(tenant, reason, [], noticeAt === ATTENTION_NOTICE_DEFERRED);
	}

	/** The connections of this integration that wait for a person and whose notice did not get through yet: the sweep files those again. */
	async findRefusedUnfiled(): Promise<IIntegrationTenant[]> {
		const rows = (await this.integrationTenantService['typeOrmRepository']
			.find({ where: { name: TRELLO_INTEGRATION_NAME, isActive: true, isArchived: false } as never, relations: { settings: true } as never })
			.catch((error: unknown) => {
				this.logger.warn(`The refused connections could not be listed: ${(error as Error)?.message ?? error}`);
				return [];
			})) as IIntegrationTenant[];
		return rows.filter((row) => {
			const settings = this.settingsOf(row);
			return !!settings[TrelloSettingName.ATTENTION_REASON] && (!settings[TrelloSettingName.ATTENTION_NOTICE_AT] || settings[TrelloSettingName.ATTENTION_NOTICE_AT] === ATTENTION_NOTICE_DEFERRED);
		});
	}

	/**
	 * Files (or resolves) the Inbox item about the connection and remembers that it got through; nothing without
	 * the Inbox plugin, or with nobody to tell. The item goes to the person who connected and to the organization's
	 * integration managers (the people whose role may add or edit integrations: they can connect again); a manager
	 * list that cannot be read leaves the person who connected, and the next filing reads it again. A filing that failed is tried again by the next {@link setAttention}
	 * and by the sweep ({@link ensureAttentionFiled}). The two writes are separate: an item that was taken but whose
	 * timestamp was not written is logged as such, and a retry re-files it without re-surfacing it.
	 */
	private async fileAttention(tenant: IIntegrationTenant, reason: string | null, alsoUserIds: readonly ID[] = [], resurface = true): Promise<void> {
		if (!this.inbox) return;
		// The row as it is now: a filing from before a reconnect or a newer refusal is stale and files nothing.
		const current = await this.findAnyById(tenant.id as ID);
		if (!current) return;
		const settings = this.settingsOf(current);
		if ((settings[TrelloSettingName.ATTENTION_REASON] || null) !== (reason || null)) return;
		const userId = settings[TrelloSettingName.CONNECTED_BY_USER_ID];
		let managers: ID[] | null = null;
		let truncated = false;
		try {
			const found = await this.integrationTenantService.findManagers({ tenantId: current.tenantId as ID, organizationId: current.organizationId as ID });
			managers = found.userIds;
			truncated = found.truncated;
		} catch (error) {
			this.logger.warn(`The integration managers of connection ${tenant.id} could not be read: ${(error as Error)?.message ?? error}`);
		}
		// The lookup stops at INTEGRATION_MANAGERS_LIMIT memberships: when it left managers out, the notice replaces nobody either.
		if (truncated) {
			this.logger.warn(`Connection ${tenant.id}: the organization has more than ${INTEGRATION_MANAGERS_LIMIT} integration manager memberships; the notice goes to the first ones and removes nobody`);
		}
		// Without the managers an open notice is not filed at all: a partial list could neither drop a former connector
		// from the shared item nor keep a current manager on it. Nothing is recorded, so the sweep files it with them
		// (a new refusal starts with no filing timestamp: see setAttention).
		if (reason && managers === null) {
			// Marked deferred, so the sweep's filing re-surfaces it for the recipients it reaches (it is a new refusal to them).
			if (settings[TrelloSettingName.ATTENTION_NOTICE_AT] !== ATTENTION_NOTICE_DEFERRED) {
				await this.writeSetting(tenant, TrelloSettingName.ATTENTION_NOTICE_AT, ATTENTION_NOTICE_DEFERRED).catch((error: unknown) => {
					this.logger.warn(`The deferred notice of connection ${tenant.id} could not be marked: ${(error as Error)?.message ?? error}`);
				});
			}
			return;
		}
		const partial = !!reason && truncated;
		const recipients = [...new Set([userId, ...(managers ?? []), ...alsoUserIds].filter(Boolean).map(String))] as ID[];
		if (!recipients.length) return;
		try {
			await this.inbox.upsertExternal(attentionItemOf({ id: tenant.id as ID, tenantId: tenant.tenantId as ID, organizationId: tenant.organizationId as ID }, reason, recipients, resurface, partial));
		} catch (error) {
			this.logger.warn(`The attention of connection ${tenant.id} could not be filed in the Inbox: ${(error as Error).message}`);
			// An open notice the Inbox did not take has not reached anyone yet: marked deferred, so the sweep's filing
			// re-surfaces it (a retry of a filing the Inbox did take is not marked, and does not re-surface).
			if (reason && resurface && settings[TrelloSettingName.ATTENTION_NOTICE_AT] !== ATTENTION_NOTICE_DEFERRED) {
				await this.writeSetting(tenant, TrelloSettingName.ATTENTION_NOTICE_AT, ATTENTION_NOTICE_DEFERRED).catch(() => undefined);
			}
			return;
		}
		try {
			await this.writeSetting(tenant, TrelloSettingName.ATTENTION_NOTICE_AT, reason ? new Date().toISOString() : '');
		} catch (error) {
			this.logger.warn(`The attention of connection ${tenant.id} was filed, but that could not be recorded (it will be filed again, without re-surfacing): ${(error as Error).message}`);
		}
	}

	/** Removes the connection; its mappings and runs go with it (foreign keys). */
	async disconnect(tenant: IIntegrationTenant): Promise<void> {
		await this.integrationTenantService.delete(tenant.id as ID);
	}

	/** Writes one setting row of the connection (updated when it exists, created otherwise) and mirrors it in memory. */
	private async writeSetting(tenant: IIntegrationTenant, name: TrelloSettingName, value: string): Promise<void> {
		const settings = (tenant.settings ?? []) as IIntegrationSetting[];
		const existing = settings.find((setting) => setting.settingsName === name);
		if (existing?.id) {
			await this.integrationSettingService.update(existing.id, { settingsValue: value } as never);
			existing.settingsValue = value;
			return;
		}
		const created: IIntegrationSetting = await this.integrationSettingService.create({
			settingsName: name,
			settingsValue: value,
			integration: { id: tenant.id },
			tenantId: tenant.tenantId,
			organizationId: tenant.organizationId
		} as never);
		tenant.settings = [...settings, created];
	}
}
