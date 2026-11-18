// Must stay first: loads the entity graph before the services pull an entity (see user.create.handler.spec.ts).
import '../core/entities/internal';

import { ForbiddenException, NotFoundException, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { RequestContext } from '../core/context';
import { EmbedCredentialResponseDTO, EmbedCredentialWithSecretResponseDTO } from './dto/embed-credential.dto';
import { EmbedCredentialService } from './embed-credential.service';
import { generateEmbedCredential, hashEmbedCredential } from './embed.utils';

const TENANT = '7a000000-0000-4000-8000-00000000000a';
const OTHER_TENANT = '7a000000-0000-4000-8000-00000000000b';
const ORG = '7a000000-0000-4000-8000-0000000000f1';
const EMPLOYEE = '7a000000-0000-4000-8000-0000000000e1';
const USER = '7a000000-0000-4000-8000-000000000001';

const matches = (row: Record<string, unknown>, where: Record<string, unknown>) =>
	Object.entries(where).every(([key, value]) =>
		value && typeof value === 'object' && (value as any)['@instanceof'] ? row[key] === null || row[key] === undefined : row[key] === value
	);

/** The service with in-memory credentials, employees and users, under the TypeORM branch. */
function build() {
	const credentials: any[] = [];
	const employees: any[] = [
		{ id: EMPLOYEE, userId: USER, tenantId: TENANT, organizationId: ORG, isActive: true, isArchived: false, isTrackingEnabled: true }
	];
	const users: any[] = [{ id: USER, tenantId: TENANT, email: 'lina@northwind.example' }];
	const memberships: any[] = [{ userId: USER, tenantId: TENANT, organizationId: ORG, isActive: true, isArchived: false }];
	const issueEmbedSession = jest.fn(async (_input: any) => 'an-embed-token');
	const table = (rows: any[]) => ({
		metadata: { hasColumnWithPropertyPath: () => true, tableName: 'x' },
		findOne: jest.fn(async ({ where }) => rows.find((row) => matches(row, where)) ?? null),
		update: jest.fn(async (criteria: any, patch: any) => {
			rows.filter((row) => matches(row, criteria)).forEach((row) => Object.assign(row, patch));
			return { affected: 1 };
		})
	});
	const service = new EmbedCredentialService(
		table(credentials) as any,
		{} as any,
		table(employees) as any,
		{} as any,
		table(users) as any,
		{} as any,
		table(memberships) as any,
		{} as any,
		{ issueEmbedSession } as any
	);
	jest.spyOn(service, 'ormType', 'get').mockReturnValue('typeorm' as any);
	jest.spyOn(service, 'create').mockImplementation(async (input: any) => {
		const row = { id: `7a000000-0000-4000-8000-00000000c00${credentials.length + 1}`, createdAt: new Date(), ...input };
		credentials.push(row);
		return row;
	});
	jest.spyOn(service, 'find').mockImplementation(async (options: any) =>
		credentials.filter((row) => matches(row, options.where)) as any
	);
	jest.spyOn(service, 'findOneByOptions').mockImplementation(async (options: any) => {
		const row = credentials.find((r) => matches(r, options.where));
		if (!row) throw new NotFoundException();
		return row;
	});
	jest.spyOn(service, 'update').mockImplementation(async (id: any, patch: any) => {
		credentials.filter((row) => row.id === id).forEach((row) => Object.assign(row, patch));
		return { affected: 1 } as any;
	});
	return { service, credentials, employees, users, memberships, issueEmbedSession };
}

const signIn = (tenantId: string) => jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(tenantId);

// The token lifetime as a server without the setting: a developer's .env (loaded with the config) may set it.
const TTL_ENV = 'GAUZY_EMBED_TOKEN_TTL_SECONDS';
let savedTtl: string | undefined;
beforeAll(() => {
	savedTtl = process.env[TTL_ENV];
});
beforeEach(() => {
	delete process.env[TTL_ENV];
});
afterAll(() => {
	if (savedTtl !== undefined) {
		process.env[TTL_ENV] = savedTtl;
	}
});

afterEach(() => jest.restoreAllMocks());

describe('EmbedCredentialService', () => {
	it('creates a credential whose secret is answered once and stored only as a digest', async () => {
		const { service, credentials } = build();
		signIn(TENANT);

		const created = await service.createForOrganization({ name: 'Northwind product', organizationId: ORG });
		const listed = await service.listForOrganization(ORG);

		expect(created).toBeInstanceOf(EmbedCredentialWithSecretResponseDTO);
		expect(created.secret).toMatch(/^gze_/);
		expect(credentials[0].keyHash).toBe(hashEmbedCredential(created.secret));
		expect(credentials[0]).not.toHaveProperty('secret');
		expect(listed).toHaveLength(1);
		expect(listed[0]).toBeInstanceOf(EmbedCredentialResponseDTO);
		expect(listed[0]).not.toHaveProperty('secret');
		expect(listed[0]).not.toHaveProperty('keyHash');
	});

	it('exchanges a credential for a token for one member, by employee id or by email', async () => {
		const { service, issueEmbedSession } = build();
		signIn(TENANT);
		const { secret } = await service.createForOrganization({ name: 'Northwind product', organizationId: ORG });

		process.env[TTL_ENV] = '600';
		const before = Date.now();
		const byId = await service.exchange({ credential: secret, employeeId: EMPLOYEE });
		const after = Date.now();
		const byEmail = await service.exchange({ credential: secret, email: 'Lina@Northwind.example' });

		expect(byId.token).toBe('an-embed-token');
		expect(new Date(byId.expiresAt).getTime()).toBeGreaterThanOrEqual(before + 600_000);
		expect(new Date(byId.expiresAt).getTime()).toBeLessThanOrEqual(after + 600_000);
		expect(byEmail.token).toBe('an-embed-token');
		expect(issueEmbedSession).toHaveBeenCalledWith(
			expect.objectContaining({ userId: USER, tenantId: TENANT, organizationId: ORG, employeeId: EMPLOYEE })
		);
	});

	it('answers 401 for a malformed, unknown or revoked credential', async () => {
		const { service } = build();
		signIn(TENANT);
		const { id, secret } = await service.createForOrganization({ name: 'Northwind product', organizationId: ORG });

		await expect(service.exchange({ credential: 'not-a-credential', employeeId: EMPLOYEE })).rejects.toThrow(UnauthorizedException);
		await expect(service.exchange({ credential: `gze_${'A'.repeat(43)}`, employeeId: EMPLOYEE })).rejects.toThrow(UnauthorizedException);
		await service.revoke(id);
		await expect(service.exchange({ credential: secret, employeeId: EMPLOYEE })).rejects.toThrow(UnauthorizedException);
	});

	it('answers 403 with a code for a member it cannot act for: unknown, without an account, or with tracking off', async () => {
		const { service, employees } = build();
		signIn(TENANT);
		const { secret } = await service.createForOrganization({ name: 'Northwind product', organizationId: ORG });

		await expect(service.exchange({ credential: secret, employeeId: '7a000000-0000-4000-8000-0000000000e9' })).rejects.toThrow(ForbiddenException);
		employees[0].isTrackingEnabled = false;
		await expect(service.exchange({ credential: secret, employeeId: EMPLOYEE })).rejects.toMatchObject({
			response: { code: 'EMBED_MEMBER_NOT_ALLOWED' }
		});
		employees[0].isTrackingEnabled = true;
		employees[0].userId = null;
		await expect(service.exchange({ credential: secret, employeeId: EMPLOYEE })).rejects.toThrow(ForbiddenException);
	});

	it('finds a member whose address is stored in another case than lowercase, as it was typed', async () => {
		const { service, users, issueEmbedSession } = build();
		signIn(TENANT);
		users[0].email = 'Lina@Northwind.example';
		const { secret } = await service.createForOrganization({ name: 'Northwind product', organizationId: ORG });

		await expect(service.exchange({ credential: secret, email: ' Lina@Northwind.example ' })).resolves.toMatchObject({
			token: 'an-embed-token'
		});
		expect(issueEmbedSession).toHaveBeenCalledWith(expect.objectContaining({ userId: USER }));
	});

	it('finds the member among the accounts of the address as sent and in lower case, in its organization', async () => {
		const { service, users, issueEmbedSession } = build();
		signIn(TENANT);
		// An account of the exact address that is no member here, and the member's own, stored in lower case.
		users.push({ id: '7a000000-0000-4000-8000-000000000002', tenantId: TENANT, email: 'Lina@Northwind.example' });
		const { secret } = await service.createForOrganization({ name: 'Northwind product', organizationId: ORG });

		await expect(service.exchange({ credential: secret, email: 'Lina@Northwind.example' })).resolves.toMatchObject({
			token: 'an-embed-token'
		});
		expect(issueEmbedSession).toHaveBeenCalledWith(expect.objectContaining({ userId: USER, employeeId: EMPLOYEE }));
	});

	it('answers 403 for a placeholder member and for a member no longer active in the organization', async () => {
		const { service, employees, memberships } = build();
		signIn(TENANT);
		const { secret } = await service.createForOrganization({ name: 'Northwind product', organizationId: ORG });

		employees[0].isPlaceholder = true;
		await expect(service.exchange({ credential: secret, employeeId: EMPLOYEE })).rejects.toMatchObject({
			response: { code: 'EMBED_MEMBER_NOT_ALLOWED' }
		});
		employees[0].isPlaceholder = false;
		memberships[0].isActive = false;
		await expect(service.exchange({ credential: secret, employeeId: EMPLOYEE })).rejects.toMatchObject({
			response: { code: 'EMBED_MEMBER_NOT_ALLOWED' }
		});
	});

	it('keeps a 503 of the mint a 503, never a refused credential', async () => {
		const { service, issueEmbedSession } = build();
		signIn(TENANT);
		const { secret } = await service.createForOrganization({ name: 'Northwind product', organizationId: ORG });
		issueEmbedSession.mockRejectedValueOnce(new ServiceUnavailableException());

		await expect(service.exchange({ credential: secret, employeeId: EMPLOYEE })).rejects.toThrow(ServiceUnavailableException);
	});

	it('answers a revocation whose lookup failed with the failure, not a 404', async () => {
		const { service } = build();
		signIn(TENANT);
		const { id } = await service.createForOrganization({ name: 'Northwind product', organizationId: ORG });
		jest.spyOn(service, 'findOneByOptions').mockRejectedValueOnce(new Error('connection terminated'));

		await expect(service.revoke(id)).rejects.toThrow('connection terminated');
	});

	it('keeps a revocation recorded while a read of the credential was on its way', async () => {
		const { service, credentials } = build();
		signIn(TENANT);
		const { id } = await service.createForOrganization({ name: 'Northwind product', organizationId: ORG });
		const live = { ...credentials[0] };
		let release: () => void = () => undefined;
		const gate = new Promise<void>((resolve) => (release = resolve));
		(service as any).typeOrmEmbedCredentialRepository.findOne.mockImplementationOnce(async () => {
			await gate;
			return live;
		});

		const pending = service.isRevoked(id);
		await service.revoke(id);
		release();

		expect(await pending).toBe(true);
		expect(await service.isRevoked(id)).toBe(true);
	});

	it('revokes only a credential of the caller tenant, and the guard sees it at once', async () => {
		const { service } = build();
		signIn(TENANT);
		const { id } = await service.createForOrganization({ name: 'Northwind product', organizationId: ORG });
		expect(await service.isRevoked(id)).toBe(false);

		signIn(OTHER_TENANT);
		await expect(service.revoke(id)).rejects.toThrow(NotFoundException);
		signIn(TENANT);
		await service.revoke(id);

		expect(await service.isRevoked(id)).toBe(true);
		expect(await service.listForOrganization(ORG)).toHaveLength(0);
	});
});

describe('EmbedCredentialService: credentials refused per address', () => {
	const HOST = '203.0.113.7';
	const OTHER_ADDRESS = '198.51.100.9';
	const NOW = 1_800_000_000_000;
	const LIMITED = { response: { statusCode: 429, code: 'EMBED_EXCHANGE_LIMITED' } };

	const unknownCredential = () => ({ credential: generateEmbedCredential().secret, employeeId: EMPLOYEE });

	/** Sends `times` made-up credentials from `address`: each is looked up and refused. */
	async function refuse(service: EmbedCredentialService, address: string, times: number): Promise<void> {
		for (let sent = 0; sent < times; sent++) {
			await expect(service.exchange(unknownCredential(), address)).rejects.toThrow(UnauthorizedException);
		}
	}

	/** The credential lookups the service made. */
	const lookupsOf = (service: EmbedCredentialService): jest.Mock =>
		(service as any).typeOrmEmbedCredentialRepository.findOne;

	it('answers 429 without a lookup once an address had 60 credentials refused, and no other address', async () => {
		const { service } = build();
		signIn(TENANT);
		await refuse(service, HOST, 60);
		lookupsOf(service).mockClear();

		await expect(service.exchange(unknownCredential(), HOST)).rejects.toMatchObject(LIMITED);
		expect(lookupsOf(service)).not.toHaveBeenCalled();

		await refuse(service, OTHER_ADDRESS, 1);
		expect(lookupsOf(service)).toHaveBeenCalledTimes(1);
	});

	it('counts the address afresh once the window has passed', async () => {
		const { service } = build();
		signIn(TENANT);
		const clock = jest.spyOn(Date, 'now').mockReturnValue(NOW);
		await refuse(service, HOST, 60);
		await expect(service.exchange(unknownCredential(), HOST)).rejects.toMatchObject(LIMITED);

		clock.mockReturnValue(NOW + 60_000);
		await refuse(service, HOST, 60);

		await expect(service.exchange(unknownCredential(), HOST)).rejects.toMatchObject(LIMITED);
	});

	it('counts lookups running at the same time before any of them is refused', async () => {
		const { service } = build();
		signIn(TENANT);

		const answers = await Promise.allSettled(
			Array.from({ length: 70 }, () => service.exchange(unknownCredential(), HOST))
		);

		expect(lookupsOf(service)).toHaveBeenCalledTimes(60);
		expect(answers.filter((answer) => answer.status === 'rejected' && answer.reason?.getStatus?.() === 429)).toHaveLength(10);
	});

	it('gives back the place of a lookup that earned a token', async () => {
		const { service } = build();
		signIn(TENANT);
		const { secret } = await service.createForOrganization({ name: 'Northwind product', organizationId: ORG });
		await expect(service.exchange({ credential: secret, employeeId: EMPLOYEE }, HOST)).resolves.toMatchObject({
			token: 'an-embed-token'
		});

		await refuse(service, HOST, 59);
		// The 60th refusal is still looked up: the accepted exchange took no place.
		await refuse(service, HOST, 1);
		await expect(service.exchange(unknownCredential(), HOST)).rejects.toMatchObject(LIMITED);
	});

	it('stops letting a credential through the cap once it is revoked', async () => {
		const { service } = build();
		signIn(TENANT);
		const { id, secret } = await service.createForOrganization({ name: 'Northwind product', organizationId: ORG });
		await expect(service.exchange({ credential: secret, employeeId: EMPLOYEE }, HOST)).resolves.toMatchObject({
			token: 'an-embed-token'
		});
		await service.revoke(id);
		await refuse(service, HOST, 60);
		lookupsOf(service).mockClear();

		await expect(service.exchange({ credential: secret, employeeId: EMPLOYEE }, HOST)).rejects.toMatchObject(LIMITED);
		expect(lookupsOf(service)).not.toHaveBeenCalled();
	});

	it('keeps exchanging a credential it accepted from an address that reached the cap', async () => {
		const { service } = build();
		signIn(TENANT);
		const { secret } = await service.createForOrganization({ name: 'Northwind product', organizationId: ORG });
		await expect(service.exchange({ credential: secret, employeeId: EMPLOYEE }, HOST)).resolves.toMatchObject({
			token: 'an-embed-token'
		});
		await refuse(service, HOST, 60);

		await expect(service.exchange({ credential: secret, employeeId: EMPLOYEE }, HOST)).resolves.toMatchObject({
			token: 'an-embed-token'
		});
		await expect(service.exchange(unknownCredential(), HOST)).rejects.toMatchObject(LIMITED);
	});
});
