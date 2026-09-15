import { BadRequestException } from '@nestjs/common';

// Module-boundary stubs, same shape as the other ai-chat service specs: `@gauzy/core` pulls the
// whole bootstrap and entity graph, and the repositories pull TypeORM decorators — none of which the
// base-URL guard touches.
jest.mock('@gauzy/core', () => ({
	RequestContext: { currentTenantId: () => 'tenant-1' },
	// The CRUD base the service calls through `super.create` / `super.update`; each delegates to an
	// instance spy the test installs, so a refused write is observable as "never reached the base".
	TenantAwareCrudService: class {
		constructor(..._repositories: unknown[]) {}
		async create(payload: unknown) {
			return (this as any).__create(payload);
		}
		async update(id: unknown, payload: unknown) {
			return (this as any).__update(id, payload);
		}
	}
}));
jest.mock('./ai-provider-credential.entity', () => ({ AiProviderCredential: class {} }));
jest.mock('./repositories/type-orm-ai-provider-credential.repository', () => ({
	TypeOrmAiProviderCredentialRepository: class {}
}));
jest.mock('./repositories/mikro-orm-ai-provider-credential.repository', () => ({
	MikroOrmAiProviderCredentialRepository: class {}
}));

import { AiProviderCredentialService } from './ai-provider-credential.service';
import { AiProviderRegistry } from '../provider-registry';
import { ALLOW_PRIVATE_BASE_URLS_ENV } from '../ssrf';

/**
 * The BYOK credential row is where the SSRF primitive of GHSA-w3mx-m5cr-3gxp is stored, and
 * `getDecryptedCredential` is the single choke point every sink reads it back through — the chat
 * route, the model catalogue, dictation, and the docs plugin's embedding/classification jobs. So the
 * guard is pinned in BOTH directions here: refused on the way in, and refused on the way out for
 * rows that predate the guard.
 */
describe('AiProviderCredentialService — base URL SSRF guard', () => {
	const originalFlag = process.env[ALLOW_PRIVATE_BASE_URLS_ENV];

	/** The registry is process-wide; a self-hosted provider is enough for every case here. */
	beforeAll(() => {
		AiProviderRegistry.register({
			id: 'openai-compatible',
			label: 'OpenAI-compatible',
			apiKeyEnvVars: [],
			models: [],
			defaultModel: '',
			order: 100,
			requiresApiKey: false,
			requiresBaseUrl: true,
			async createModel() {
				return {} as never;
			}
		} as never);
	});

	afterEach(() => {
		if (originalFlag === undefined) {
			delete process.env[ALLOW_PRIVATE_BASE_URLS_ENV];
		} else {
			process.env[ALLOW_PRIVATE_BASE_URLS_ENV] = originalFlag;
		}
		jest.restoreAllMocks();
	});

	beforeEach(() => {
		delete process.env[ALLOW_PRIVATE_BASE_URLS_ENV];
	});

	/**
	 * A service whose persistence layer is recorded rather than performed.
	 *
	 * `findOneOrFailByOptions` answers with `existing` (a stored row) so both the create and the
	 * update branch can be driven, and `create`/`update` are spies so a test can assert that a
	 * refused URL never reached the database.
	 */
	const buildService = (existing?: Record<string, unknown>) => {
		const service = new AiProviderCredentialService({} as never, {} as never, {
			encrypt: (value: string) => `enc(${value})`,
			decrypt: (value: string) => String(value).replace(/^enc\(|\)$/g, '')
		} as never);

		const create = jest.fn().mockImplementation(async (payload: Record<string, unknown>) => ({ ...payload }));
		const update = jest.fn().mockResolvedValue(undefined);
		(service as any).__create = create;
		(service as any).__update = update;

		(service as any).findOneOrFailByOptions = jest
			.fn()
			.mockResolvedValue(existing ? { success: true, record: existing } : { success: false, record: null });
		(service as any).findOneByIdString = jest.fn().mockResolvedValue(existing ?? null);
		(service as any).find = jest.fn().mockResolvedValue([]);

		return { service, create, update };
	};

	describe('store time', () => {
		const REFUSED = [
			'http://169.254.169.254/latest/meta-data/',
			'http://169.254.169.254/latest/meta-data/?',
			'http://localhost:8080/v1',
			'http://127.0.0.1:11434/v1',
			'http://[::1]:8000/v1',
			'http://10.0.0.5/v1',
			'http://192.168.1.10:8080/v1',
			'https://user:pw@api.example.com/v1'
		];

		it.each(REFUSED)('upsert refuses %s and persists nothing', async (baseUrl) => {
			const { service, create, update } = buildService();

			await expect(service.upsert({ providerId: 'openai-compatible', baseUrl } as never)).rejects.toBeInstanceOf(
				BadRequestException
			);
			expect(create).not.toHaveBeenCalled();
			expect(update).not.toHaveBeenCalled();
		});

		it.each(REFUSED)('updateCredential refuses %s and persists nothing', async (baseUrl) => {
			const { service, update } = buildService({
				id: 'cred-1',
				tenantId: 'tenant-1',
				providerId: 'openai-compatible',
				baseUrl: 'https://llm.example.com/v1',
				enabled: true
			});

			await expect(service.updateCredential('cred-1', { baseUrl } as never)).rejects.toBeInstanceOf(
				BadRequestException
			);
			expect(update).not.toHaveBeenCalled();
		});

		it('still accepts a legitimate public https provider endpoint', async () => {
			const { service, create } = buildService();

			await expect(
				service.upsert({ providerId: 'openai-compatible', baseUrl: 'https://llm.example.com/v1' } as never)
			).resolves.toBeDefined();
			expect(create).toHaveBeenCalledTimes(1);
			expect(create.mock.calls[0][0]).toMatchObject({ baseUrl: 'https://llm.example.com/v1' });
		});

		it('accepts a loopback endpoint once the deployment opts in', async () => {
			process.env[ALLOW_PRIVATE_BASE_URLS_ENV] = 'true';
			const { service, create } = buildService();

			await expect(
				service.upsert({ providerId: 'openai-compatible', baseUrl: 'http://localhost:8080/v1' } as never)
			).resolves.toBeDefined();
			expect(create).toHaveBeenCalledTimes(1);
		});
	});

	describe('read time (rows stored before the guard existed)', () => {
		const storedRow = (baseUrl: string) => ({
			id: 'cred-1',
			tenantId: 'tenant-1',
			providerId: 'openai-compatible',
			baseUrl,
			apiKey: '',
			enabled: true
		});

		it.each([
			'http://169.254.169.254/latest/meta-data/',
			'http://localhost:8080/v1',
			'http://10.0.0.5/v1',
			'http://internal.example.com/v1?'
		])('drops a credential whose stored base URL is %s, so no sink ever sees it', async (baseUrl) => {
			const { service } = buildService(storedRow(baseUrl));

			await expect(service.getDecryptedCredential('openai-compatible', 'tenant-1')).resolves.toBeNull();
		});

		it('never writes the refused host into the log line', async () => {
			const { service } = buildService(storedRow('http://10.1.2.3:9000/v1'));
			const warn = jest.spyOn((service as any).logger, 'warn').mockImplementation(() => undefined);

			await service.getDecryptedCredential('openai-compatible', 'tenant-1');

			expect(warn).toHaveBeenCalledTimes(1);
			expect(String(warn.mock.calls[0][0])).not.toContain('10.1.2.3');
		});

		it('returns a credential whose stored base URL is a public https endpoint', async () => {
			const { service } = buildService(storedRow('https://llm.example.com/v1'));

			await expect(service.getDecryptedCredential('openai-compatible', 'tenant-1')).resolves.toMatchObject({
				baseUrl: 'https://llm.example.com/v1'
			});
		});

		it('returns a loopback credential once the deployment opts in', async () => {
			process.env[ALLOW_PRIVATE_BASE_URLS_ENV] = 'true';
			const { service } = buildService(storedRow('http://localhost:8080/v1'));

			await expect(service.getDecryptedCredential('openai-compatible', 'tenant-1')).resolves.toMatchObject({
				baseUrl: 'http://localhost:8080/v1'
			});
		});
	});
});
