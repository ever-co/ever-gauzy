// cspell:ignore sqljs
const assert = require('node:assert/strict');
const { before, after, test } = require('node:test');
const { randomUUID } = require('node:crypto');
const Module = require('node:module');
require('reflect-metadata');
require('ts-node').register({
	transpileOnly: true,
	compilerOptions: {
		module: 'commonjs',
		moduleResolution: 'node',
		experimentalDecorators: true,
		emitDecoratorMetadata: true
	}
});
const { DataSource, EntitySchema } = require('typeorm');
const { of } = require('rxjs');
const { SetMetadata } = require('@nestjs/common');

// Minimal real SQL schema keeps these tests independent of the whole application bootstrap.
// Repository filters, transactions, cascaded settings and joins execute against SQLite.
const names = [
	'IntegrationType',
	'Integration',
	'IntegrationTenant',
	'IntegrationSetting',
	'UserOrganization',
	'Organization',
	'Employee',
	'OrganizationProject',
	'Task'
];
const entities = Object.fromEntries(names.map((name) => [name, { [name]: class {} }[name]]));
const id = () => randomUUID();
const tenantId = id(),
	organizationId = id(),
	otherOrganizationId = id(),
	userId = id();
const RequestContext = {
	currentTenantId: () => tenantId,
	currentOrganizationId: () => organizationId,
	currentUserId: () => userId
};
const originalLoad = Module._load;
Module._load = function (name, parent, isMain) {
	if (name === '@gauzy/constants') return require('../packages/constants/src/lib/reflect-metadata.ts');
	if (name === '@gauzy/common') return require('../packages/common/src/lib/decorators/public.decorator.ts');
	if (name === '@gauzy/core')
		return {
			...entities,
			RequestContext,
			createSsrfSafeHttpsAgent: () => new (require('node:https').Agent)(),
			Public: () => SetMetadata('isPublic', true)
		};
	if (name === '@gauzy/contracts')
		return {
			IntegrationEnum: { EVER_ASYNC: 'Ever_Async' },
			IntegrationTypeEnum: { ALL_INTEGRATIONS: 'All Integrations', PROJECT_MANAGEMENT: 'Project Management' }
		};
	if (name === '@gauzy/utils') return require('../packages/utils/src/lib/ssrf-url.ts');
	return originalLoad.call(this, name, parent, isMain);
};
const {
	EverAsyncIntegrationService
} = require('../packages/plugins/integration-ever-async/src/lib/ever-async-integration.service.ts');
const {
	EverAsyncConnectorController,
	EverAsyncConnectorGuard
} = require('../packages/plugins/integration-ever-async/src/lib/ever-async-connector.controller.ts');
const {
	EverAsyncRateLimitGuard
} = require('../packages/plugins/integration-ever-async/src/lib/ever-async-rate-limit.guard.ts');
const { AuthGuard } = require('../packages/core/src/lib/shared/guards/auth.guard.ts');
const {
	ConfigureEverAsyncIntegrationDto
} = require('../packages/plugins/integration-ever-async/src/lib/dto/configure-ever-async-integration.dto.ts');
const {
	UpdateEverAsyncSettingsDto
} = require('../packages/plugins/integration-ever-async/src/lib/dto/update-ever-async-settings.dto.ts');
Module._load = originalLoad;

const base = {
	id: { type: String, primary: true },
	tenantId: { type: String, nullable: true },
	organizationId: { type: String, nullable: true },
	isActive: { type: Boolean, default: true },
	isArchived: { type: Boolean, default: false }
};
const schema = (name, columns, relations) =>
	new EntitySchema({ name, target: entities[name], columns: { ...base, ...columns }, relations });
const schemas = [
	schema('IntegrationType', { name: { type: String } }),
	schema(
		'Integration',
		{
			name: { type: String, unique: true },
			provider: { type: String },
			imgSrc: { type: String },
			redirectUrl: { type: String },
			isComingSoon: { type: Boolean },
			isPaid: { type: Boolean },
			order: { type: Number }
		},
		{ integrationTypes: { type: 'many-to-many', target: 'IntegrationType', joinTable: true } }
	),
	schema(
		'IntegrationTenant',
		{ name: { type: String }, integrationId: { type: String, nullable: true } },
		{ settings: { type: 'one-to-many', target: 'IntegrationSetting', inverseSide: 'integration', cascade: true } }
	),
	schema(
		'IntegrationSetting',
		{ settingsName: { type: String }, settingsValue: { type: String } },
		{ integration: { type: 'many-to-one', target: 'IntegrationTenant', joinColumn: true } }
	),
	schema('UserOrganization', { userId: { type: String } }),
	schema('Organization', {}),
	schema('Employee', {}),
	schema('OrganizationProject', { name: { type: String } }),
	schema(
		'Task',
		{
			title: { type: String },
			status: { type: String, nullable: true },
			number: { type: Number, nullable: true },
			projectId: { type: String },
			updatedAt: { type: Date }
		},
		{
			members: { type: 'many-to-many', target: 'Employee', joinTable: true },
			project: { type: 'many-to-one', target: 'OrganizationProject', joinColumn: true }
		}
	)
];
let db, service, employeeId, projectId, foreignProjectId, foreignEmployeeId, taskId;
const requests = [];
before(async () => {
	const testUrl = process.env.GAUZY_ASYNC_TEST_DATABASE_URL;
	if (testUrl) {
		const target = new URL(testUrl);
		if (!['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) || !target.pathname.endsWith('_test')) {
			throw new Error('Postgres integration tests require a loopback fixture database ending in _test.');
		}
	}
	const testSchema = 'gauzy_async_' + randomUUID().replaceAll('-', '');
	db = await new DataSource(
		testUrl
			? { type: 'postgres', url: testUrl, schema: testSchema, entities: schemas }
			: { type: 'sqljs', entities: schemas }
	).initialize();
	if (testUrl) await db.query('CREATE SCHEMA "' + testSchema + '"');
	await db.synchronize();
	service = new EverAsyncIntegrationService(db, {
		get: (url, options) => {
			requests.push({ url, options });
			return of({ data: 'ok' });
		}
	});
	employeeId = id();
	projectId = id();
	foreignProjectId = id();
	foreignEmployeeId = id();
	taskId = id();
	const scoped = { tenantId, organizationId, isActive: true, isArchived: false };
	await db.getRepository(entities.Organization).save({ id: organizationId, tenantId });
	await db.getRepository(entities.UserOrganization).save({ id: id(), ...scoped, userId });
	await db.getRepository(entities.Employee).save([
		{ id: employeeId, ...scoped },
		{ id: foreignEmployeeId, ...scoped, organizationId: otherOrganizationId }
	]);
	await db.getRepository(entities.OrganizationProject).save([
		{ id: projectId, ...scoped, name: 'Included' },
		{ id: foreignProjectId, ...scoped, organizationId: otherOrganizationId, name: 'Foreign' }
	]);
	await db.getRepository(entities.Task).save([
		{
			id: taskId,
			...scoped,
			title: 'Current task',
			number: 7,
			status: 'open',
			projectId,
			members: [{ id: employeeId }],
			updatedAt: new Date()
		},
		{
			id: id(),
			...scoped,
			title: 'Foreign task',
			projectId: foreignProjectId,
			organizationId: otherOrganizationId,
			updatedAt: new Date()
		}
	]);
});
after(async () => {
	if (db) await db.destroy();
});

test('organization-scoped setup, one-time credentials, live mappings and project enforcement', async () => {
	const dto = {
		serverUrl: 'https://api-async.ever.co',
		userMappings: [{ channel: 'slack', workspace: 'T123', chatUserId: 'U123', employeeId }],
		projectIds: [projectId]
	};
	await assert.rejects(service.setupIntegration(dto, otherOrganizationId), /organization/i);
	await assert.rejects(
		service.setupIntegration({ ...dto, projectIds: [foreignProjectId] }, organizationId),
		/project/i
	);
	await assert.rejects(
		service.setupIntegration(
			{
				...dto,
				userMappings: [
					{ channel: 'slack', workspace: 'T123', chatUserId: 'U123', employeeId: foreignEmployeeId }
				]
			},
			organizationId
		),
		/employee/i
	);
	const created = await service.setupIntegration(dto, organizationId);
	assert.equal(typeof created.apiKey, 'string');
	assert.equal(typeof created.apiSecret, 'string');
	const persisted = JSON.stringify(await db.getRepository(entities.IntegrationSetting).find());
	assert.ok(!persisted.includes(created.apiSecret), 'plaintext secret must never be persisted');
	const settings = await service.getSettings(organizationId);
	assert.equal(settings.hasApiKey, true);
	assert.ok(!JSON.stringify(settings).includes(created.apiSecret));
	await assert.rejects(service.getSettings(otherOrganizationId), /organization/i);
	await assert.rejects(service.authenticateConnector(created.integrationTenantId, '', ''), /credential/i);
	await assert.rejects(
		service.authenticateConnector(created.integrationTenantId, created.apiKey, 'wrong'),
		/credential/i
	);
	await assert.rejects(service.authenticateConnector(id(), created.apiKey, created.apiSecret), /credential/i);
	let scope = await service.authenticateConnector(created.integrationTenantId, created.apiKey, created.apiSecret);
	assert.equal(scope.tenantId, tenantId);
	assert.equal(scope.organizationId, organizationId);
	assert.deepEqual(
		(await service.getConnectorTasks(scope, { channel: 'slack', workspace: 'T123', chatUserId: 'U123' })).items.map(
			(x) => x.id
		),
		[taskId]
	);
	assert.equal(
		(await service.getConnectorTasks(scope, { channel: 'slack', workspace: 'T123', chatUserId: 'unmapped' })).items
			.length,
		0
	);
	assert.equal((await service.getConnectorTasks(scope, { taskId })).items.length, 1);
	assert.equal(
		(await service.getConnectorTasks(scope, { channel: 'slack', workspace: 'OTHER', chatUserId: 'U123' })).items
			.length,
		0
	);
	assert.equal(
		(await service.getConnectorTasks(scope, { channel: 'discord', workspace: 'T123', chatUserId: 'U123' })).items
			.length,
		0
	);
	await assert.rejects(service.getConnectorTasks(scope, { chatUserId: 'U123' }), /chat user/i);
	await assert.rejects(
		service.updateSettings({ userMappings: [dto.userMappings[0], dto.userMappings[0]] }, organizationId),
		/one employee mapping/i
	);
	await service.updateSettings(
		{ userMappings: [dto.userMappings[0], { ...dto.userMappings[0], workspace: 'SECOND' }] },
		organizationId
	);
	scope = await service.authenticateConnector(created.integrationTenantId, created.apiKey, created.apiSecret);
	assert.equal(
		(await service.getConnectorTasks(scope, { channel: 'slack', workspace: 'SECOND', chatUserId: 'U123' })).items
			.length,
		1
	);
	await service.updateSettings({ projectIds: [] }, organizationId);
	scope = await service.authenticateConnector(created.integrationTenantId, created.apiKey, created.apiSecret);
	assert.equal((await service.getConnectorTasks(scope, { taskId })).items.length, 0);
	await service.updateSettings({ projectIds: [projectId], userMappings: [] }, organizationId);
	scope = await service.authenticateConnector(created.integrationTenantId, created.apiKey, created.apiSecret);
	assert.equal(
		(await service.getConnectorTasks(scope, { channel: 'slack', workspace: 'T123', chatUserId: 'U123' })).items
			.length,
		0
	);
	const rotated = await service.rotateCredentials(organizationId);
	await assert.rejects(
		service.authenticateConnector(created.integrationTenantId, created.apiKey, created.apiSecret),
		/credential/i
	);
	await service.authenticateConnector(created.integrationTenantId, rotated.apiKey, rotated.apiSecret);
	await service.updateSettings({ isEnabled: false }, organizationId);
	await assert.rejects(
		service.authenticateConnector(created.integrationTenantId, rotated.apiKey, rotated.apiSecret),
		/disabled/i
	);
	await service.removeIntegration(created.integrationTenantId, organizationId);
	assert.equal((await service.getStatus(organizationId)).isEnabled, false);
	assert.equal(await db.getRepository(entities.Task).count(), 2, 'connector does not change tasks');
});

test('verification rejects unsafe destinations and disables redirects and proxies', async () => {
	for (const serverUrl of [
		'http://example.com',
		'https://127.0.0.1',
		'https://169.254.169.254',
		'https://user:password@example.com'
	]) {
		await assert.rejects(service.verifyConnection(serverUrl), /URL|HTTPS|private|credentials/i);
	}
	assert.equal(requests.length, 0);
	assert.equal((await service.verifyConnection('https://api-async.ever.co/')).ok, true);
	assert.equal(requests[0].url, 'https://api-async.ever.co/healthz');
	assert.equal(requests[0].options.maxRedirects, 0);
	assert.equal(requests[0].options.proxy, false);
	assert.ok(requests[0].options.httpsAgent);
});

test('actual HTTP guard rejects anonymous, wrong-integration and disabled connector access', async () => {
	const { Test } = require('@nestjs/testing');
	const { APP_GUARD } = require('@nestjs/core');
	const module = await Test.createTestingModule({
		controllers: [EverAsyncConnectorController],
		providers: [
			{ provide: EverAsyncIntegrationService, useValue: service },
			EverAsyncConnectorGuard,
			EverAsyncRateLimitGuard,
			{ provide: APP_GUARD, useClass: AuthGuard }
		]
	}).compile();
	const app = module.createNestApplication({ logger: false });
	app.setGlobalPrefix('api');
	await app.listen(0, '127.0.0.1');
	try {
		const key = await service.setupIntegration(
			{
				serverUrl: 'https://api-async.ever.co',
				projectIds: [projectId],
				userMappings: [{ channel: 'slack', workspace: 'T123', chatUserId: 'U123', employeeId }]
			},
			organizationId
		);
		const base = await app.getUrl();
		const path = base + '/api/integration/ever-async/connector';
		assert.equal((await fetch(path + '/status')).status, 401);
		const headers = {
			'X-INTEGRATION-ID': key.integrationTenantId,
			'X-APP-ID': key.apiKey,
			'X-API-KEY': key.apiSecret,
			'Tenant-Id': id()
		};
		const status = await fetch(path + '/status', { headers });
		assert.equal(status.status, 200);
		assert.equal((await status.json()).tenantId, tenantId, 'caller headers cannot change credential scope');
		assert.equal(status.headers.get('cache-control'), 'no-store');
		const tasks = await fetch(
			path + '/tasks?channel=slack&workspace=T123&chatUserId=U123&organizationId=' + otherOrganizationId,
			{ headers }
		);
		assert.deepEqual(
			(await tasks.json()).items.map((item) => item.id),
			[taskId]
		);
		assert.equal(
			(await fetch(path + '/status', { headers: { ...headers, 'X-INTEGRATION-ID': id() } })).status,
			401
		);
		assert.equal((await fetch(path + '/tasks?chatUserId=U123&taskId=' + taskId, { headers })).status, 400);
		await service.updateSettings({ isEnabled: false }, organizationId);
		assert.equal((await fetch(path + '/status', { headers })).status, 403);
	} finally {
		await app.close();
	}
});

test('connector rate limits reject excess traffic and reopen after the window', (t) => {
	const guard = new EverAsyncRateLimitGuard();
	let now = 100000;
	t.mock.method(Date, 'now', () => now);
	const headers = {};
	const context = {
		switchToHttp: () => ({
			getRequest: () => ({ ip: '127.0.0.1', socket: {}, headers: { 'x-forwarded-for': 'attacker-controlled' } }),
			getResponse: () => ({
				setHeader: (name, value) => {
					headers[name] = value;
				}
			})
		})
	};
	for (let i = 0; i < 600; i++) assert.equal(guard.canActivate(context), true);
	assert.throws(
		() => guard.canActivate(context),
		(error) => error.getStatus() === 429
	);
	assert.equal(headers['Retry-After'], 60);
	now += 60000;
	assert.equal(guard.canActivate(context), true);
});

test('DTOs reject null patches, unscoped chat identities and malformed project IDs', async () => {
	const { plainToInstance } = require('class-transformer');
	const { validate } = require('class-validator');
	for (const payload of [
		{ userMappings: null },
		{ projectIds: null },
		{ isEnabled: null },
		{ projectIds: ['not-a-uuid'] },
		{ userMappings: [{ chatUserId: 'U123', employeeId }] }
	]) {
		assert.ok((await validate(plainToInstance(UpdateEverAsyncSettingsDto, payload))).length > 0);
	}
	assert.ok(
		(await validate(plainToInstance(ConfigureEverAsyncIntegrationDto, { serverUrl: 'http://localhost' }))).length >
			0
	);
});

test('concurrent setup produces one catalog and one live organization credential', async () => {
	const concurrentOrg = id();
	await db.getRepository(entities.Organization).save({ id: concurrentOrg, tenantId });
	await db
		.getRepository(entities.UserOrganization)
		.save({ id: id(), tenantId, organizationId: concurrentOrg, userId });
	const secondService = new EverAsyncIntegrationService(db, { get: () => of({ data: 'ok' }) });
	const results = await Promise.allSettled([
		service.setupIntegration({ serverUrl: 'https://api-async.ever.co' }, concurrentOrg),
		secondService.setupIntegration({ serverUrl: 'https://api-async.ever.co' }, concurrentOrg)
	]);
	assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
	const rejected = results.find((result) => result.status === 'rejected');
	assert.equal(rejected.reason.getStatus(), 409);
	assert.equal(await db.getRepository(entities.Integration).countBy({ name: 'Ever_Async' }), 1);
	assert.equal(
		await db
			.getRepository(entities.IntegrationTenant)
			.countBy({ tenantId, organizationId: concurrentOrg, isActive: true, isArchived: false }),
		1
	);
});
