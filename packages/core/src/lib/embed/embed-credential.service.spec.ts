// Must stay first: loads the entity graph before the services pull an entity (see user.create.handler.spec.ts).
import '../core/entities/internal';

import {
	BadRequestException,
	ForbiddenException,
	InternalServerErrorException,
	NotFoundException,
	ServiceUnavailableException,
	UnauthorizedException
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { DataSource } from 'typeorm';
import { RequestContext } from '../core/context';
import { IEmbedClientReport } from '@gauzy/contracts';
import { EmbedCredentialResponseDTO, EmbedCredentialWithSecretResponseDTO } from './dto/embed-credential.dto';
import { EmbedCredentialService } from './embed-credential.service';
import { EmbedMemberService } from './embed-member.service';
import { generateEmbedCredential, hashEmbedCredential } from './embed.utils';

const TENANT = '7a000000-0000-4000-8000-00000000000a';
const OTHER_TENANT = '7a000000-0000-4000-8000-00000000000b';
const ORG = '7a000000-0000-4000-8000-0000000000f1';
const EMPLOYEE = '7a000000-0000-4000-8000-0000000000e1';
const USER = '7a000000-0000-4000-8000-000000000001';
const CONTACT = '7a000000-0000-4000-8000-0000000000d1';
const OTHER_ORG_CONTACT = '7a000000-0000-4000-8000-0000000000d2';
const UNKNOWN_CONTACT = '7a000000-0000-4000-8000-0000000000d9';
// The page origin the organization allows.
const SITE = 'https://app.northwind.example';

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
	const contacts = [{ id: CONTACT, name: 'Northwind', tenantId: TENANT, organizationId: ORG }];
	// The contacts of a tenant and organization, as `EmbedClientService` reads them (its own spec runs it on SQLite).
	const findClient = jest.fn(async (id: string, scope: { tenantId: string; organizationId: string }) => {
		const found = contacts.find((contact) => {
			const isAsked = contact.id === id;
			const isInScope = contact.tenantId === scope.tenantId && contact.organizationId === scope.organizationId;
			return isAsked && isInScope;
		});
		return found ?? null;
	});
	// The report of a client found as above; its counting has its own specs (SQLite and pure).
	const reportOf = jest.fn(async (id: string, scope: { tenantId: string; organizationId: string }, _now: Date) => {
		const client = await findClient(id, scope);
		if (!client) {
			return null;
		}
		return { ...NORTHWIND_REPORT, client: { id: client.id, name: client.name } };
	});
	// The turns are the service's own; an addition files the person as the platform's commands file them (their own
	// spec runs them on SQLite, `embed-member.service.sqlite.spec.ts`).
	const memberService = new EmbedMemberService(
		{ options: { type: 'better-sqlite3' } } as unknown as DataSource,
		{} as CommandBus
	);
	const addMember = jest.spyOn(memberService, 'add').mockImplementation(async (scope, person) => {
		const count = String(users.length).padStart(2, '0');
		const userId = `7a000000-0000-4000-8000-0000000001${count}`;
		const employeeId = `7a000000-0000-4000-8000-0000000002${count}`;
		// Another exchange may run while this one is on its way to the database.
		await new Promise((resolve) => setImmediate(resolve));
		users.push({ id: userId, tenantId: scope.tenantId, email: person.email.toLowerCase() });
		const membership = { userId, ...scope, isActive: true, isArchived: false };
		employees.push({ ...membership, id: employeeId, isTrackingEnabled: true });
		memberships.push(membership);
		return { employeeId };
	});
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
		{ issueEmbedSession } as any,
		{
			isAllowed: jest.fn(
				async (tenantId: string, organizationId: string, origin: string) =>
					tenantId === TENANT && organizationId === ORG && origin === SITE
			)
		} as any,
		{ findClient, reportOf } as any,
		memberService
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
	return {
		service,
		credentials,
		employees,
		users,
		memberships,
		issueEmbedSession,
		contacts,
		findClient,
		reportOf,
		addMember
	};
}

const NORTHWIND_REPORT: IEmbedClientReport = {
	client: { id: CONTACT, name: 'Northwind' },
	timeZone: 'Europe/Paris',
	today: { date: '2026-11-19', seconds: 7200 },
	week: { start: '2026-11-16', end: '2026-11-22', seconds: 23400 },
	projects: [{ id: '7a000000-0000-4000-8000-0000000000a1', name: 'Website', seconds: 23400 }]
};

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

	it('keeps a credential without a client one of the whole organization', async () => {
		const { service, credentials, findClient } = build();
		signIn(TENANT);

		const created = await service.createForOrganization({ name: 'Northwind product', organizationId: ORG });
		const [listed] = await service.listForOrganization(ORG);

		expect(findClient).not.toHaveBeenCalled();
		expect(credentials[0].organizationContactId).toBeNull();
		expect(created.organizationContactId).toBeNull();
		expect(listed.organizationContactId).toBeNull();
	});

	it('limits a credential to a client of its organization, and lists it with that client', async () => {
		const { service, credentials, findClient } = build();
		signIn(TENANT);

		const created = await service.createForOrganization({
			name: 'Northwind portal',
			organizationId: ORG,
			organizationContactId: CONTACT
		});
		const [listed] = await service.listForOrganization(ORG);

		expect(findClient).toHaveBeenCalledWith(CONTACT, { tenantId: TENANT, organizationId: ORG });
		expect(credentials[0].organizationContactId).toBe(CONTACT);
		expect(created.organizationContactId).toBe(CONTACT);
		expect(listed.organizationContactId).toBe(CONTACT);
	});

	it('creates a credential that adds no member unless asked, and lists the option', async () => {
		const { service, credentials } = build();
		signIn(TENANT);

		const plain = await service.createForOrganization({ name: 'Northwind product', organizationId: ORG });
		const adding = await service.createForOrganization({
			name: 'Fabrikam portal',
			organizationId: ORG,
			canAddMembers: true
		});
		const listed = await service.listForOrganization(ORG);

		expect(credentials.map((row) => row.canAddMembers)).toEqual([false, true]);
		expect(plain.canAddMembers).toBe(false);
		expect(adding.canAddMembers).toBe(true);
		expect(listed.map((row) => row.canAddMembers).sort()).toEqual([false, true]);
	});

	it('lists a credential stored before the option as one that adds no member', async () => {
		const { service, credentials } = build();
		signIn(TENANT);
		credentials.push({
			id: '7a000000-0000-4000-8000-00000000c0a1',
			name: 'Older',
			organizationId: ORG,
			tenantId: TENANT
		});

		const [listed] = await service.listForOrganization(ORG);

		expect(listed.canAddMembers).toBe(false);
	});

	it('refuses with a 400 a client that is no contact of the organization, and creates nothing', async () => {
		const { service, credentials, contacts } = build();
		const otherOrganization = '7a000000-0000-4000-8000-0000000000f2';
		contacts.push({ id: OTHER_ORG_CONTACT, name: 'Contoso', tenantId: TENANT, organizationId: otherOrganization });
		signIn(TENANT);

		for (const organizationContactId of [OTHER_ORG_CONTACT, UNKNOWN_CONTACT]) {
			await expect(
				service.createForOrganization({ name: 'Portal', organizationId: ORG, organizationContactId })
			).rejects.toThrow(BadRequestException);
		}
		signIn(OTHER_TENANT);
		await expect(
			service.createForOrganization({ name: 'Portal', organizationId: ORG, organizationContactId: CONTACT })
		).rejects.toThrow(BadRequestException);

		expect(credentials).toHaveLength(0);
	});

	it('exchanges a credential for a token for one member, by employee id or by email', async () => {
		const { service, issueEmbedSession } = build();
		signIn(TENANT);
		const { secret } = await service.createForOrganization({ name: 'Northwind product', organizationId: ORG });

		process.env[TTL_ENV] = '600';
		const before = Date.now();
		const byId = await service.exchange({ credential: secret, employeeId: EMPLOYEE, origin: SITE });
		const after = Date.now();
		const byEmail = await service.exchange({ credential: secret, email: 'Lina@Northwind.example', origin: SITE });

		expect(byId.token).toBe('an-embed-token');
		expect(new Date(byId.expiresAt).getTime()).toBeGreaterThanOrEqual(before + 600_000);
		expect(new Date(byId.expiresAt).getTime()).toBeLessThanOrEqual(after + 600_000);
		expect(byEmail.token).toBe('an-embed-token');
		expect(issueEmbedSession).toHaveBeenCalledWith(
			expect.objectContaining({ userId: USER, tenantId: TENANT, organizationId: ORG, employeeId: EMPLOYEE, origin: SITE })
		);
	});

	it('answers 401 for a malformed, unknown or revoked credential', async () => {
		const { service } = build();
		signIn(TENANT);
		const { id, secret } = await service.createForOrganization({ name: 'Northwind product', organizationId: ORG });

		await expect(service.exchange({ credential: 'not-a-credential', employeeId: EMPLOYEE })).rejects.toThrow(UnauthorizedException);
		await expect(service.exchange({ credential: `gze_${'A'.repeat(43)}`, employeeId: EMPLOYEE })).rejects.toThrow(UnauthorizedException);
		await service.revoke(id);
		await expect(service.exchange({ credential: secret, employeeId: EMPLOYEE, origin: SITE })).rejects.toThrow(UnauthorizedException);
	});

	it('answers 403 with a code for a member it cannot act for: unknown, without an account, or with tracking off', async () => {
		const { service, employees } = build();
		signIn(TENANT);
		const { secret } = await service.createForOrganization({ name: 'Northwind product', organizationId: ORG });

		await expect(service.exchange({ credential: secret, employeeId: '7a000000-0000-4000-8000-0000000000e9', origin: SITE })).rejects.toThrow(ForbiddenException);
		employees[0].isTrackingEnabled = false;
		await expect(service.exchange({ credential: secret, employeeId: EMPLOYEE, origin: SITE })).rejects.toMatchObject({
			response: { code: 'EMBED_MEMBER_NOT_ALLOWED' }
		});
		employees[0].isTrackingEnabled = true;
		employees[0].userId = null;
		await expect(service.exchange({ credential: secret, employeeId: EMPLOYEE, origin: SITE })).rejects.toThrow(ForbiddenException);
	});

	it('finds a member whose address is stored in another case than lowercase, as it was typed', async () => {
		const { service, users, issueEmbedSession } = build();
		signIn(TENANT);
		users[0].email = 'Lina@Northwind.example';
		const { secret } = await service.createForOrganization({ name: 'Northwind product', organizationId: ORG });

		await expect(service.exchange({ credential: secret, email: ' Lina@Northwind.example ', origin: SITE })).resolves.toMatchObject({
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

		await expect(service.exchange({ credential: secret, email: 'Lina@Northwind.example', origin: SITE })).resolves.toMatchObject({
			token: 'an-embed-token'
		});
		expect(issueEmbedSession).toHaveBeenCalledWith(expect.objectContaining({ userId: USER, employeeId: EMPLOYEE }));
	});

	it('answers 403 for a placeholder member and for a member no longer active in the organization', async () => {
		const { service, employees, memberships } = build();
		signIn(TENANT);
		const { secret } = await service.createForOrganization({ name: 'Northwind product', organizationId: ORG });

		employees[0].isPlaceholder = true;
		await expect(service.exchange({ credential: secret, employeeId: EMPLOYEE, origin: SITE })).rejects.toMatchObject({
			response: { code: 'EMBED_MEMBER_NOT_ALLOWED' }
		});
		employees[0].isPlaceholder = false;
		memberships[0].isActive = false;
		await expect(service.exchange({ credential: secret, employeeId: EMPLOYEE, origin: SITE })).rejects.toMatchObject({
			response: { code: 'EMBED_MEMBER_NOT_ALLOWED' }
		});
	});

	it('keeps a 503 of the mint a 503, never a refused credential', async () => {
		const { service, issueEmbedSession } = build();
		signIn(TENANT);
		const { secret } = await service.createForOrganization({ name: 'Northwind product', organizationId: ORG });
		issueEmbedSession.mockRejectedValueOnce(new ServiceUnavailableException());

		await expect(service.exchange({ credential: secret, employeeId: EMPLOYEE, origin: SITE })).rejects.toThrow(ServiceUnavailableException);
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

	it('answers 403 with a code for a page origin the organization does not allow, or none', async () => {
		const { service, issueEmbedSession } = build();
		signIn(TENANT);
		const { secret } = await service.createForOrganization({ name: 'Northwind product', organizationId: ORG });

		for (const origin of ['https://evil.example', `${SITE}/timer`, undefined]) {
			await expect(service.exchange({ credential: secret, employeeId: EMPLOYEE, origin })).rejects.toMatchObject({
				response: { code: 'EMBED_ORIGIN_NOT_ALLOWED' }
			});
		}
		expect(issueEmbedSession).not.toHaveBeenCalled();
		await expect(service.exchange({ credential: secret, employeeId: EMPLOYEE, origin: 'https://APP.northwind.example:443' })).resolves.toHaveProperty('token');
	});

	it("writes the credential's client into the token it mints, and none for a credential of the whole organization", async () => {
		const { service, issueEmbedSession } = build();
		signIn(TENANT);
		const portal = await service.createForOrganization({
			name: 'Northwind portal',
			organizationId: ORG,
			organizationContactId: CONTACT
		});
		const product = await service.createForOrganization({ name: 'Northwind product', organizationId: ORG });

		await service.exchange({ credential: portal.secret, employeeId: EMPLOYEE, origin: SITE });
		await service.exchange({ credential: product.secret, employeeId: EMPLOYEE, origin: SITE });

		const [ofPortal, ofProduct] = issueEmbedSession.mock.calls.map(([input]) => input);
		expect(ofPortal).toMatchObject({ credentialId: portal.id, employeeId: EMPLOYEE, clientId: CONTACT });
		expect(ofProduct).toMatchObject({ credentialId: product.id, employeeId: EMPLOYEE });
		expect(ofProduct.clientId ?? null).toBeNull();
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
		await expect(service.exchange({ credential: secret, employeeId: EMPLOYEE, origin: SITE }, HOST)).resolves.toMatchObject({
			token: 'an-embed-token'
		});

		await refuse(service, HOST, 59);
		// The 60th refusal is still looked up: the accepted exchange took no place.
		await refuse(service, HOST, 1);
		await expect(service.exchange(unknownCredential(), HOST)).rejects.toMatchObject(LIMITED);
	});

	it('refuses a credential revoked while its lookup was on its way, and does not accept it again', async () => {
		const { service, credentials, issueEmbedSession } = build();
		signIn(TENANT);
		const { id, secret } = await service.createForOrganization({ name: 'Northwind product', organizationId: ORG });
		const live = { ...credentials[0] };
		let release: () => void = () => undefined;
		const gate = new Promise<void>((resolve) => (release = resolve));
		lookupsOf(service).mockImplementationOnce(async () => {
			await gate;
			return live;
		});

		const pending = service.exchange({ credential: secret, employeeId: EMPLOYEE, origin: SITE }, HOST);
		await service.revoke(id);
		release();

		await expect(pending).rejects.toThrow(UnauthorizedException);
		expect(issueEmbedSession).not.toHaveBeenCalled();
		// The refused exchange took one place of the 60.
		await refuse(service, HOST, 59);
		await expect(service.exchange({ credential: secret, employeeId: EMPLOYEE, origin: SITE }, HOST)).rejects.toMatchObject(LIMITED);
	});

	it('stops letting a credential through the cap once it is revoked', async () => {
		const { service } = build();
		signIn(TENANT);
		const { id, secret } = await service.createForOrganization({ name: 'Northwind product', organizationId: ORG });
		await expect(service.exchange({ credential: secret, employeeId: EMPLOYEE, origin: SITE }, HOST)).resolves.toMatchObject({
			token: 'an-embed-token'
		});
		await service.revoke(id);
		await refuse(service, HOST, 60);
		lookupsOf(service).mockClear();

		await expect(service.exchange({ credential: secret, employeeId: EMPLOYEE, origin: SITE }, HOST)).rejects.toMatchObject(LIMITED);
		expect(lookupsOf(service)).not.toHaveBeenCalled();
	});

	it('keeps exchanging a credential it accepted from an address that reached the cap', async () => {
		const { service } = build();
		signIn(TENANT);
		const { secret } = await service.createForOrganization({ name: 'Northwind product', organizationId: ORG });
		await expect(service.exchange({ credential: secret, employeeId: EMPLOYEE, origin: SITE }, HOST)).resolves.toMatchObject({
			token: 'an-embed-token'
		});
		await refuse(service, HOST, 60);

		await expect(service.exchange({ credential: secret, employeeId: EMPLOYEE, origin: SITE }, HOST)).resolves.toMatchObject({
			token: 'an-embed-token'
		});
		await expect(service.exchange(unknownCredential(), HOST)).rejects.toMatchObject(LIMITED);
	});
});

describe('EmbedCredentialService: client report', () => {
	const PORTAL = '203.0.113.20';

	/** A credential limited to Northwind, as an administrator creates it. */
	async function northwindCredential(service: EmbedCredentialService) {
		signIn(TENANT);
		return await service.createForOrganization({
			name: 'Northwind portal',
			organizationId: ORG,
			organizationContactId: CONTACT
		});
	}

	it("answers the report of the credential's client, read in its tenant and organization, and records the use", async () => {
		const { service, credentials, reportOf } = build();
		const { secret } = await northwindCredential(service);

		const report = await service.clientReport({ credential: secret }, PORTAL);

		expect(report).toEqual(NORTHWIND_REPORT);
		expect(reportOf).toHaveBeenCalledWith(CONTACT, { tenantId: TENANT, organizationId: ORG }, expect.any(Date));
		expect(credentials[0].lastUsedAt).toBeInstanceOf(Date);
	});

	it('answers 401 for a malformed, unknown or revoked credential, and reads no report', async () => {
		const { service, reportOf } = build();
		const { id, secret } = await northwindCredential(service);

		const malformed = { credential: 'not-a-credential' };
		await expect(service.clientReport(malformed, PORTAL)).rejects.toThrow(UnauthorizedException);
		await expect(service.clientReport({ credential: generateEmbedCredential().secret }, PORTAL)).rejects.toThrow(
			UnauthorizedException
		);
		await expect(service.clientReport(undefined, PORTAL)).rejects.toThrow(UnauthorizedException);
		await service.revoke(id);
		await expect(service.clientReport({ credential: secret }, PORTAL)).rejects.toThrow(UnauthorizedException);

		expect(reportOf).not.toHaveBeenCalled();
	});

	it('answers 403 EMBED_CLIENT_REQUIRED for a credential of the whole organization', async () => {
		const { service, reportOf } = build();
		signIn(TENANT);
		const { secret } = await service.createForOrganization({ name: 'Northwind product', organizationId: ORG });

		await expect(service.clientReport({ credential: secret }, PORTAL)).rejects.toMatchObject({
			status: 403,
			response: { code: 'EMBED_CLIENT_REQUIRED' }
		});
		expect(reportOf).not.toHaveBeenCalled();
	});

	it('answers 403 EMBED_CLIENT_GONE once the client is deleted, never a report of the whole organization', async () => {
		const { service, contacts } = build();
		const { secret } = await northwindCredential(service);
		// Deleted softly: the contact is no longer found, as `EmbedClientService` reads it.
		contacts.splice(0, 1);

		await expect(service.clientReport({ credential: secret }, PORTAL)).rejects.toMatchObject({
			status: 403,
			response: { code: 'EMBED_CLIENT_GONE' }
		});
	});

	it('answers a report it could not read with a 500, or a 503 for a database out of reach, never a 401', async () => {
		const { service, reportOf } = build();
		const { secret } = await northwindCredential(service);

		reportOf.mockRejectedValueOnce(new Error('SQLITE_BUSY: database is locked'));
		await expect(service.clientReport({ credential: secret }, PORTAL)).rejects.toThrow(InternalServerErrorException);
		reportOf.mockRejectedValueOnce(new Error('Connection terminated unexpectedly'));
		await expect(service.clientReport({ credential: secret }, PORTAL)).rejects.toThrow(ServiceUnavailableException);

		await expect(service.clientReport({ credential: secret }, PORTAL)).resolves.toEqual(NORTHWIND_REPORT);
	});

	it('counts its refused credentials against the address, with the exchange, up to the same cap', async () => {
		const { service } = build();
		const { secret } = await northwindCredential(service);
		for (let sent = 0; sent < 30; sent++) {
			await expect(
				service.clientReport({ credential: generateEmbedCredential().secret }, PORTAL)
			).rejects.toThrow(UnauthorizedException);
			await expect(
				service.exchange({ credential: generateEmbedCredential().secret, employeeId: EMPLOYEE }, PORTAL)
			).rejects.toThrow(UnauthorizedException);
		}

		await expect(
			service.clientReport({ credential: generateEmbedCredential().secret }, PORTAL)
		).rejects.toMatchObject({ response: { statusCode: 429, code: 'EMBED_EXCHANGE_LIMITED' } });
		// A credential this server did not accept before is capped too; another address is not.
		await expect(service.clientReport({ credential: secret }, PORTAL)).rejects.toMatchObject({ status: 429 });
		await expect(service.clientReport({ credential: secret }, '198.51.100.30')).resolves.toEqual(NORTHWIND_REPORT);
	});

	it('caps the exchange of an address whose client reports alone reached the cap, but not a credential it accepted', async () => {
		const { service } = build();
		signIn(TENANT);
		const accepted = await service.createForOrganization({ name: 'Northwind product', organizationId: ORG });
		const fresh = await service.createForOrganization({ name: 'Northwind product 2', organizationId: ORG });
		await expect(service.exchange({ credential: accepted.secret, employeeId: EMPLOYEE, origin: SITE }, PORTAL)).resolves.toMatchObject({
			token: 'an-embed-token'
		});
		for (let sent = 0; sent < 60; sent++) {
			await expect(
				service.clientReport({ credential: generateEmbedCredential().secret }, PORTAL)
			).rejects.toThrow(UnauthorizedException);
		}

		// One count of refused credentials per address, whichever route refused them: a valid credential this server
		// has not accepted yet waits for the window to end, one it accepted goes on.
		await expect(service.exchange({ credential: fresh.secret, employeeId: EMPLOYEE, origin: SITE }, PORTAL)).rejects.toMatchObject({
			response: { statusCode: 429, code: 'EMBED_EXCHANGE_LIMITED' }
		});
		await expect(service.exchange({ credential: accepted.secret, employeeId: EMPLOYEE, origin: SITE }, PORTAL)).resolves.toMatchObject({
			token: 'an-embed-token'
		});
	});
});

describe('EmbedCredentialService: the members a credential adds', () => {
	const PORTAL = '203.0.113.40';
	const NOOR = 'Noor.Haddad@Fabrikam.example';
	const MEMBER_REFUSED = { status: 403, response: { code: 'EMBED_MEMBER_NOT_ALLOWED' } };

	/** A credential of the organization, with the option or without it. */
	async function credentialOf(service: EmbedCredentialService, canAddMembers: boolean) {
		signIn(TENANT);
		return await service.createForOrganization({ name: 'Fabrikam portal', organizationId: ORG, canAddMembers });
	}

	/** The lines the service logged, at every level. */
	function logsOf(service: EmbedCredentialService): string[] {
		const logger = (service as any).logger;
		const lines: string[] = [];
		for (const level of ['log', 'warn', 'error']) {
			jest.spyOn(logger, level).mockImplementation((line: string) => {
				lines.push(line);
			});
		}
		return lines;
	}

	it("answers today's 403 for an address without a member when the credential does not add members", async () => {
		const { service, addMember, issueEmbedSession, employees } = build();
		const { secret } = await credentialOf(service, false);

		await expect(service.exchange({ credential: secret, email: NOOR, origin: SITE }, PORTAL)).rejects.toMatchObject(
			MEMBER_REFUSED
		);

		expect(addMember).not.toHaveBeenCalled();
		expect(issueEmbedSession).not.toHaveBeenCalled();
		expect(employees).toHaveLength(1);
	});

	it('adds a new address as a member of its organization, with the names sent, and answers its token', async () => {
		const { service, addMember, issueEmbedSession, employees } = build();
		const { id, secret } = await credentialOf(service, true);
		const lines = logsOf(service);

		const answer = await service.exchange(
			{ credential: secret, email: ` ${NOOR} `, firstName: ' Noor ', lastName: 'Haddad', origin: SITE },
			PORTAL
		);

		expect(answer.token).toBe('an-embed-token');
		expect(addMember).toHaveBeenCalledTimes(1);
		expect(addMember).toHaveBeenCalledWith(
			{ tenantId: TENANT, organizationId: ORG },
			{ email: NOOR, firstName: 'Noor', lastName: 'Haddad' }
		);
		const added = employees[1];
		expect(issueEmbedSession).toHaveBeenCalledWith(
			expect.objectContaining({
				userId: added.userId,
				employeeId: added.id,
				tenantId: TENANT,
				organizationId: ORG
			})
		);
		expect(lines).toContain(`Embed member added: credential=${id} employee=${added.id}`);
		expect(lines.join('\n').toLowerCase()).not.toContain('noor');
	});

	it("writes the credential's client into the token of a member it adds, as into a member's it finds", async () => {
		const { service, addMember, issueEmbedSession, employees } = build();
		signIn(TENANT);
		const portal = await service.createForOrganization({
			name: 'Fabrikam portal',
			organizationId: ORG,
			organizationContactId: CONTACT,
			canAddMembers: true
		});

		await service.exchange({ credential: portal.secret, email: NOOR, origin: SITE }, PORTAL);
		await service.exchange({ credential: portal.secret, email: 'lina@northwind.example', origin: SITE }, PORTAL);

		expect(addMember).toHaveBeenCalledTimes(1);
		const [ofAdded, ofFound] = issueEmbedSession.mock.calls.map(([input]) => input);
		expect(ofAdded).toMatchObject({ credentialId: portal.id, employeeId: employees[1].id, clientId: CONTACT });
		expect(ofFound).toMatchObject({ credentialId: portal.id, employeeId: EMPLOYEE, clientId: CONTACT });
	});

	it('finds an existing member as before, without adding anyone', async () => {
		const { service, addMember, issueEmbedSession } = build();
		const { secret } = await credentialOf(service, true);

		await expect(
			service.exchange({ credential: secret, email: 'lina@northwind.example', origin: SITE }, PORTAL)
		).resolves.toHaveProperty('token');

		expect(addMember).not.toHaveBeenCalled();
		expect(issueEmbedSession).toHaveBeenCalledWith(expect.objectContaining({ userId: USER, employeeId: EMPLOYEE }));
	});

	it("adds no one for an exchange by employee id or without a valid address: today's 403", async () => {
		const { service, addMember } = build();
		const { secret } = await credentialOf(service, true);
		const unknownEmployee = '7a000000-0000-4000-8000-0000000000e9';

		for (const named of [
			{ employeeId: unknownEmployee },
			{ employeeId: unknownEmployee, email: NOOR },
			{ email: 'noor@' },
			{ email: 'noor.haddad' },
			{ email: 42 as unknown as string },
			{}
		]) {
			await expect(
				service.exchange({ credential: secret, origin: SITE, ...named }, PORTAL)
			).rejects.toMatchObject(MEMBER_REFUSED);
		}
		expect(addMember).not.toHaveBeenCalled();
	});

	it('answers 403 with the code, and the reason in the log, when the person may not be added', async () => {
		const { service, addMember, issueEmbedSession } = build();
		const { id, secret } = await credentialOf(service, true);
		const lines = logsOf(service);
		addMember.mockResolvedValueOnce({ refused: 'the account has a role other than employee' });

		await expect(
			service.exchange({ credential: secret, email: 'ada@northwind.example', origin: SITE }, PORTAL)
		).rejects.toMatchObject(MEMBER_REFUSED);

		expect(issueEmbedSession).not.toHaveBeenCalled();
		expect(lines).toContain(`Embed exchange refused: the account has a role other than employee credential=${id}`);
	});

	it('answers 500 when the addition fails, and 503 when the database is out of reach, never a 401', async () => {
		const { service, addMember } = build();
		const { secret } = await credentialOf(service, true);
		const lines = logsOf(service);

		addMember.mockRejectedValueOnce(new Error(`Duplicate entry '${NOOR}' for key 'email'`));
		await expect(service.exchange({ credential: secret, email: NOOR, origin: SITE }, PORTAL)).rejects.toThrow(
			InternalServerErrorException
		);
		addMember.mockRejectedValueOnce(new Error('Connection terminated unexpectedly'));
		await expect(service.exchange({ credential: secret, email: NOOR, origin: SITE }, PORTAL)).rejects.toThrow(
			ServiceUnavailableException
		);

		// The log names the failure, never the address a database message may quote.
		expect(lines.join('\n').toLowerCase()).not.toContain('noor');
	});

	it('answers 500, never 401, when a read around the addition fails, and logs no address', async () => {
		const { service } = build();
		const { secret } = await credentialOf(service, true);
		const lines = logsOf(service);
		// The read of the member just added fails, with a message that quotes the address.
		jest.spyOn((service as any).typeOrmEmployeeRepository, 'findOne').mockRejectedValueOnce(
			new Error(`select from "employee" where "email" = '${NOOR}'`)
		);

		await expect(service.exchange({ credential: secret, email: NOOR, origin: SITE }, PORTAL)).rejects.toThrow(
			InternalServerErrorException
		);

		expect(lines.join('\n').toLowerCase()).not.toContain('noor');
	});

	it('adds one member for two exchanges of the same new address at once, and answers both with its token', async () => {
		const { service, addMember, issueEmbedSession, employees } = build();
		const { secret } = await credentialOf(service, true);

		const answers = await Promise.all([
			service.exchange({ credential: secret, email: NOOR, origin: SITE }, PORTAL),
			service.exchange({ credential: secret, email: NOOR.toLowerCase(), origin: SITE }, PORTAL)
		]);

		expect(answers.map((answer) => answer.token)).toEqual(['an-embed-token', 'an-embed-token']);
		expect(addMember).toHaveBeenCalledTimes(1);
		expect(employees).toHaveLength(2);
		const minted = issueEmbedSession.mock.calls.map(([input]) => input.employeeId);
		expect(minted).toEqual([employees[1].id, employees[1].id]);
	});
});
