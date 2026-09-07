// cspell:ignore sqljs
import {
	BadGatewayException,
	BadRequestException,
	ConflictException,
	ForbiddenException,
	Injectable,
	NotFoundException,
	UnauthorizedException,
	OnApplicationBootstrap
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { randomBytes, randomUUID, scrypt, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import { DataSource, EntityManager, In } from 'typeorm';
import { firstValueFrom } from 'rxjs';
import { isUUID } from 'class-validator';
import { ID, IntegrationEnum, IntegrationTypeEnum } from '@gauzy/contracts';
import {
	createSsrfSafeHttpsAgent,
	Employee,
	Integration,
	IntegrationType,
	IntegrationSetting,
	IntegrationTenant,
	Organization,
	OrganizationProject,
	RequestContext,
	Task,
	UserOrganization
} from '@gauzy/core';
import { getUnsafeOutboundUrlReason } from '@gauzy/utils';
import { ConfigureEverAsyncIntegrationDto, UpdateEverAsyncSettingsDto } from './dto';
import { EverAsyncSettingName as Setting } from './ever-async-setting.enum';

const scryptAsync = promisify(scrypt);

export interface EverAsyncConnectorScope {
	integrationTenantId: ID;
	tenantId: ID;
	organizationId: ID;
	projectIds: ID[];
	userMappings: { channel: string; workspace: string; chatUserId: string; employeeId: ID }[];
}

/** Organization-scoped management and a separate, read-only connector boundary. */
@Injectable()
export class EverAsyncIntegrationService implements OnApplicationBootstrap {
	private readonly httpsAgent = createSsrfSafeHttpsAgent();
	private static readonly sqliteTransactions = new WeakMap<DataSource, Promise<void>>();

	constructor(
		private readonly dataSource: DataSource,
		private readonly httpService: HttpService
	) {}

	/** SQLite shares one connection; queue plugin transactions rather than nesting them. */
	private async transaction<T>(work: (manager: EntityManager) => Promise<T>): Promise<T> {
		if (!['sqlite', 'better-sqlite3', 'sqljs'].includes(this.dataSource.options.type)) {
			return this.dataSource.transaction(work);
		}
		const queue = EverAsyncIntegrationService.sqliteTransactions;
		const previous = queue.get(this.dataSource) ?? Promise.resolve();
		let release!: () => void;
		const current = new Promise<void>((resolve) => {
			release = resolve;
		});
		queue.set(this.dataSource, current);
		await previous;
		try {
			return await this.dataSource.transaction(work);
		} finally {
			release();
			if (queue.get(this.dataSource) === current) queue.delete(this.dataSource);
		}
	}

	async onApplicationBootstrap() {
		await this.ensureCatalog();
	}

	/** Make the plugin discoverable on existing installations as well as fresh seeds. */
	private async ensureCatalog() {
		return this.transaction(async (manager) => {
			if (manager.connection.options.type === 'postgres')
				await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['ever-async:catalog']);
			// The unique catalog name makes first startup safe across all supported SQL drivers.
			await manager
				.createQueryBuilder()
				.insert()
				.into(Integration)
				.values({
					id: randomUUID(),
					name: IntegrationEnum.EVER_ASYNC,
					provider: IntegrationEnum.EVER_ASYNC,
					imgSrc: 'integrations/ever-async.svg',
					redirectUrl: 'ever-async',
					isComingSoon: false,
					isPaid: false,
					order: 12
				})
				.orIgnore()
				.execute();
			if (['postgres', 'mysql', 'mariadb'].includes(manager.connection.options.type)) {
				await manager.findOneOrFail(Integration, {
					where: { name: IntegrationEnum.EVER_ASYNC },
					lock: { mode: 'pessimistic_write' }
				});
			}
			const integration = await manager.findOneOrFail(Integration, {
				where: { name: IntegrationEnum.EVER_ASYNC },
				relations: { integrationTypes: true }
			});
			const types = await manager.find(IntegrationType, {
				where: { name: In([IntegrationTypeEnum.ALL_INTEGRATIONS, IntegrationTypeEnum.PROJECT_MANAGEMENT]) }
			});
			const missing = types.filter(
				(type) => !integration.integrationTypes?.some((current) => current.id === type.id)
			);
			if (!missing.length) return integration;
			integration.integrationTypes = [...(integration.integrationTypes ?? []), ...missing];
			return manager.save(Integration, integration);
		});
	}

	private async scope(organizationId?: ID) {
		const tenantId = RequestContext.currentTenantId();
		const userId = RequestContext.currentUserId();
		organizationId ??= RequestContext.currentOrganizationId() ?? undefined;
		if (!tenantId || !userId || !organizationId || !isUUID(organizationId)) {
			throw new ForbiddenException('An authenticated organization context is required.');
		}
		const membership = await this.dataSource.getRepository(UserOrganization).findOneBy({
			tenantId,
			organizationId,
			userId,
			isActive: true,
			isArchived: false
		});
		if (!membership) throw new ForbiddenException('Access to this organization is required.');
		return { tenantId, organizationId };
	}

	private async find(scope: { tenantId: ID; organizationId: ID }, manager = this.dataSource.manager) {
		return manager.findOne(IntegrationTenant, {
			where: { ...scope, name: IntegrationEnum.EVER_ASYNC, isActive: true, isArchived: false },
			relations: { settings: true }
		});
	}

	private async requireIntegration(organizationId?: ID) {
		const scope = await this.scope(organizationId);
		const integration = await this.find(scope);
		if (!integration?.id || !integration.tenantId || !integration.organizationId)
			throw new NotFoundException('Ever Async is not configured for this organization.');
		return integration as IntegrationTenant & { id: ID; tenantId: ID; organizationId: ID };
	}

	private settings(integration: IntegrationTenant): Record<string, string> {
		return Object.fromEntries((integration.settings ?? []).map((s) => [s.settingsName, s.settingsValue]));
	}

	private parseArray<T>(raw?: string): T[] {
		if (!raw) return [];
		try {
			const value: unknown = JSON.parse(raw);
			return Array.isArray(value) ? (value as T[]) : [];
		} catch {
			return [];
		}
	}

	private set(integration: IntegrationTenant, values: Record<string, string>, manager: EntityManager) {
		integration.settings ??= [];
		for (const [settingsName, settingsValue] of Object.entries(values)) {
			const existing = integration.settings.find((s) => s.settingsName === settingsName);
			if (existing) existing.settingsValue = settingsValue;
			else
				integration.settings.push(
					manager.create(IntegrationSetting, {
						id: randomUUID(),
						tenantId: integration.tenantId,
						organizationId: integration.organizationId,
						settingsName,
						settingsValue
					})
				);
		}
	}

	private async credentials() {
		const apiKey = randomBytes(16).toString('hex');
		const apiSecret = randomBytes(32).toString('hex');
		const digest = ((await scryptAsync(apiSecret, apiKey, 64)) as Buffer).toString('hex');
		return { apiKey, apiSecret, digest };
	}

	private serverUrl(input: string) {
		const reason = getUnsafeOutboundUrlReason(input);
		if (reason) throw new BadRequestException(`Invalid Ever Async URL: ${reason}`);
		const url = new URL(input);
		if (url.search || url.hash)
			throw new BadRequestException('Ever Async URL must not contain a query or fragment.');
		return url.toString().replace(/\/+$/, '');
	}

	private async validateSelection(dto: UpdateEverAsyncSettingsDto, scope: { tenantId: ID; organizationId: ID }) {
		if (dto.userMappings !== undefined) {
			const mappings = dto.userMappings;
			if (
				new Set(mappings.map((m) => JSON.stringify([m.channel, m.workspace, m.chatUserId]))).size !==
				mappings.length
			) {
				throw new BadRequestException(
					'Each chat user can have only one employee mapping per channel and workspace.'
				);
			}
			const ids = [...new Set(mappings.map((m) => m.employeeId))];
			if (
				ids.length &&
				(await this.dataSource
					.getRepository(Employee)
					.countBy({ ...scope, id: In(ids), isActive: true, isArchived: false })) !== ids.length
			) {
				throw new BadRequestException('Every mapped employee must be active in this organization.');
			}
		}
		if (dto.projectIds !== undefined) {
			const ids = [...new Set(dto.projectIds)];
			if (
				ids.length &&
				(await this.dataSource
					.getRepository(OrganizationProject)
					.countBy({ ...scope, id: In(ids), isActive: true, isArchived: false })) !== ids.length
			) {
				throw new BadRequestException('Every selected project must be active in this organization.');
			}
		}
	}

	async setupIntegration(dto: ConfigureEverAsyncIntegrationDto, organizationId?: ID) {
		const scope = await this.scope(organizationId);
		const serverUrl = this.serverUrl(dto.serverUrl);
		await this.validateSelection(dto, scope);
		const base = await this.ensureCatalog();
		return this.transaction(async (manager) => {
			// Serialize setup even before an IntegrationTenant row exists.
			if (manager.connection.options.type === 'postgres') {
				await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
					`ever-async:${scope.tenantId}:${scope.organizationId}`
				]);
			}
			if (['mysql', 'mariadb'].includes(manager.connection.options.type)) {
				await manager.findOneOrFail(Organization, {
					where: { id: scope.organizationId, tenantId: scope.tenantId },
					lock: { mode: 'pessimistic_write' }
				});
			}
			if (await this.find(scope, manager))
				throw new ConflictException('Ever Async is already configured for this organization.');
			const integration = manager.create(IntegrationTenant, {
				id: randomUUID(),
				...scope,
				name: IntegrationEnum.EVER_ASYNC,
				integrationId: base.id,
				isActive: true,
				isArchived: false
			});
			const key = await this.credentials();
			this.set(
				integration,
				{
					[Setting.EVER_ASYNC_SERVER_URL]: serverUrl,
					[Setting.EVER_ASYNC_USER_MAPPINGS]: JSON.stringify(dto.userMappings ?? []),
					[Setting.EVER_ASYNC_PROJECT_IDS]: JSON.stringify(dto.projectIds ?? []),
					[Setting.EVER_ASYNC_KEY_ID]: key.apiKey,
					[Setting.EVER_ASYNC_SECRET_HASH]: key.digest,
					[Setting.IS_ENABLED]: 'true'
				},
				manager
			);
			await manager.save(IntegrationTenant, integration);
			return { integrationTenantId: integration.id, ...scope, apiKey: key.apiKey, apiSecret: key.apiSecret };
		});
	}

	async getSettings(organizationId?: ID) {
		const integration = await this.requireIntegration(organizationId);
		const settings = this.settings(integration);
		return {
			integrationTenantId: integration.id,
			tenantId: integration.tenantId,
			organizationId: integration.organizationId,
			serverUrl: settings[Setting.EVER_ASYNC_SERVER_URL] ?? '',
			userMappings: this.parseArray<{ channel: string; workspace: string; chatUserId: string; employeeId: ID }>(
				settings[Setting.EVER_ASYNC_USER_MAPPINGS]
			),
			projectIds: this.parseArray<ID>(settings[Setting.EVER_ASYNC_PROJECT_IDS]),
			isEnabled: settings[Setting.IS_ENABLED] === 'true',
			hasApiKey: !!settings[Setting.EVER_ASYNC_SECRET_HASH]
		};
	}

	private async mutate<T>(
		organizationId: ID | undefined,
		change: (
			integration: IntegrationTenant & { id: ID; tenantId: ID; organizationId: ID },
			manager: EntityManager
		) => Promise<T>
	) {
		const scope = await this.scope(organizationId);
		return this.transaction(async (manager) => {
			if (['postgres', 'mysql', 'mariadb'].includes(manager.connection.options.type)) {
				await manager.findOne(IntegrationTenant, {
					where: { ...scope, name: IntegrationEnum.EVER_ASYNC, isActive: true, isArchived: false },
					lock: { mode: 'pessimistic_write' }
				});
			}
			const integration = await this.find(scope, manager);
			if (!integration?.id || !integration.tenantId || !integration.organizationId)
				throw new NotFoundException('Ever Async is not configured for this organization.');
			return change(integration as IntegrationTenant & { id: ID; tenantId: ID; organizationId: ID }, manager);
		});
	}

	async updateSettings(dto: UpdateEverAsyncSettingsDto, organizationId?: ID) {
		return this.mutate(organizationId, async (integration, manager) => {
			await this.validateSelection(dto, {
				tenantId: integration.tenantId,
				organizationId: integration.organizationId
			});
			const values: Record<string, string> = {};
			if (dto.serverUrl !== undefined) values[Setting.EVER_ASYNC_SERVER_URL] = this.serverUrl(dto.serverUrl);
			if (dto.userMappings !== undefined)
				values[Setting.EVER_ASYNC_USER_MAPPINGS] = JSON.stringify(dto.userMappings);
			if (dto.projectIds !== undefined)
				values[Setting.EVER_ASYNC_PROJECT_IDS] = JSON.stringify([...new Set(dto.projectIds)]);
			if (dto.isEnabled !== undefined) values[Setting.IS_ENABLED] = String(dto.isEnabled);
			this.set(integration, values, manager);
			await manager.save(IntegrationTenant, integration);
			return { integrationTenantId: integration.id, updated: true };
		});
	}

	async rotateCredentials(organizationId?: ID) {
		return this.mutate(organizationId, async (integration, manager) => {
			const key = await this.credentials();
			this.set(
				integration,
				{ [Setting.EVER_ASYNC_KEY_ID]: key.apiKey, [Setting.EVER_ASYNC_SECRET_HASH]: key.digest },
				manager
			);
			await manager.save(IntegrationTenant, integration);
			return {
				integrationTenantId: integration.id,
				tenantId: integration.tenantId,
				organizationId: integration.organizationId,
				apiKey: key.apiKey,
				apiSecret: key.apiSecret
			};
		});
	}

	async getStatus(organizationId?: ID) {
		const integration = await this.find(await this.scope(organizationId));
		return {
			isEnabled: !!integration && this.settings(integration)[Setting.IS_ENABLED] === 'true',
			integrationTenantId: integration?.id ?? null
		};
	}

	async removeIntegration(integrationTenantId: ID, organizationId?: ID) {
		return this.mutate(organizationId, async (integration, manager) => {
			if (integration.id !== integrationTenantId)
				throw new NotFoundException('Ever Async integration not found.');
			integration.isActive = false;
			integration.isArchived = true;
			this.set(integration, { [Setting.IS_ENABLED]: 'false' }, manager);
			await manager.save(IntegrationTenant, integration);
			return { success: true };
		});
	}

	async verifyConnection(serverUrl: string) {
		const target = this.serverUrl(serverUrl);
		try {
			const response = await firstValueFrom(
				this.httpService.get(`${target}/healthz`, {
					timeout: 5000,
					maxRedirects: 0,
					maxContentLength: 1024,
					proxy: false,
					httpsAgent: this.httpsAgent
				})
			);
			if (typeof response.data !== 'string' || response.data.trim() !== 'ok')
				throw new Error('Unexpected health response');
			return { ok: true, serverUrl: target };
		} catch {
			throw new BadGatewayException('The Ever Async server did not return a valid health response.');
		}
	}

	async getOptions(organizationId?: ID) {
		const scope = await this.scope(organizationId);
		const where = { ...scope, isActive: true, isArchived: false };
		const [employees, projects] = await Promise.all([
			this.dataSource.getRepository(Employee).find({ where, relations: { user: true } }),
			this.dataSource.getRepository(OrganizationProject).find({ where, order: { name: 'ASC' } })
		]);
		return {
			employees: employees.map((employee) => ({
				id: employee.id,
				name: [employee.user?.firstName, employee.user?.lastName].filter(Boolean).join(' ') || employee.id
			})),
			projects: projects.map((project) => ({ id: project.id, name: project.name }))
		};
	}

	async authenticateConnector(
		integrationTenantId: string,
		apiKey: string,
		apiSecret: string
	): Promise<EverAsyncConnectorScope> {
		if (!isUUID(integrationTenantId) || !/^[a-f0-9]{32}$/.test(apiKey) || !/^[a-f0-9]{64}$/.test(apiSecret))
			throw new UnauthorizedException('Invalid connector credentials.');
		const integration = await this.dataSource.getRepository(IntegrationTenant).findOne({
			where: { id: integrationTenantId, name: IntegrationEnum.EVER_ASYNC, isActive: true, isArchived: false },
			relations: { settings: true }
		});
		const settings = integration ? this.settings(integration) : {};
		const stored = settings[Setting.EVER_ASYNC_SECRET_HASH] ?? '';
		if (settings[Setting.EVER_ASYNC_KEY_ID] !== apiKey || !/^[a-f0-9]{128}$/.test(stored)) {
			throw new UnauthorizedException('Invalid connector credentials.');
		}
		const digest = ((await scryptAsync(apiSecret, apiKey, 64)) as Buffer).toString('hex');
		if (
			!integration?.id ||
			!integration.tenantId ||
			!integration.organizationId ||
			settings[Setting.EVER_ASYNC_KEY_ID] !== apiKey ||
			stored.length !== digest.length ||
			!timingSafeEqual(Buffer.from(stored), Buffer.from(digest))
		) {
			throw new UnauthorizedException('Invalid connector credentials.');
		}
		if (settings[Setting.IS_ENABLED] !== 'true')
			throw new ForbiddenException('Ever Async integration is disabled.');
		return {
			integrationTenantId: integration.id,
			tenantId: integration.tenantId,
			organizationId: integration.organizationId,
			projectIds: this.parseArray<ID>(settings[Setting.EVER_ASYNC_PROJECT_IDS]),
			userMappings: this.parseArray<{ channel: string; workspace: string; chatUserId: string; employeeId: ID }>(
				settings[Setting.EVER_ASYNC_USER_MAPPINGS]
			)
		};
	}

	async getConnectorTasks(
		scope: EverAsyncConnectorScope,
		query: { channel?: string; workspace?: string; chatUserId?: string; taskId?: ID }
	) {
		if (!!query.chatUserId === !!query.taskId)
			throw new BadRequestException('Supply exactly one chatUserId or taskId.');
		if (query.taskId && !isUUID(query.taskId)) throw new BadRequestException('Invalid task ID.');
		if (
			query.chatUserId &&
			(typeof query.chatUserId !== 'string' ||
				query.chatUserId.length > 200 ||
				!['slack', 'discord'].includes(query.channel ?? '') ||
				typeof query.workspace !== 'string' ||
				!/^[^\s]{1,200}$/.test(query.workspace))
		)
			throw new BadRequestException('Invalid chat user ID.');
		const empty = { items: [], total: 0 };
		if (!scope.projectIds.length) return empty;
		const employeeId = query.chatUserId
			? scope.userMappings.find(
					(m) =>
						m.channel === query.channel &&
						m.workspace === query.workspace &&
						m.chatUserId === query.chatUserId
				)?.employeeId
			: undefined;
		if (query.chatUserId && !employeeId) return empty;
		const active = {
			tenantId: scope.tenantId,
			organizationId: scope.organizationId,
			isActive: true,
			isArchived: false
		};
		const tasks = await this.dataSource.getRepository(Task).find({
			where: {
				...active,
				...(query.taskId ? { id: query.taskId } : {}),
				project: { ...active, id: In(scope.projectIds) },
				...(employeeId ? { members: { ...active, id: employeeId } } : {})
			},
			order: { updatedAt: 'DESC', id: 'DESC' },
			take: 10,
			select: { id: true, title: true, status: true, number: true, projectId: true, updatedAt: true }
		});
		const items = tasks.map((task) => ({
			id: task.id,
			title: task.title,
			status: task.status ?? null,
			taskNumber: task.number ?? null,
			projectId: task.projectId
		}));
		return { items, total: items.length };
	}
}
