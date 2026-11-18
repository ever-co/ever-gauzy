// Must stay first: loads the entity graph before the services pull an entity (see user.create.handler.spec.ts).
import '../core/entities/internal';

import { ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { RequestContext } from '../core/context';
import { EmbedCredentialResponseDTO, EmbedCredentialWithSecretResponseDTO } from './dto/embed-credential.dto';
import { EmbedCredentialService } from './embed-credential.service';
import { hashEmbedCredential } from './embed.utils';

const TENANT = '7a000000-0000-4000-8000-00000000000a';
const OTHER_TENANT = '7a000000-0000-4000-8000-00000000000b';
const ORG = '7a000000-0000-4000-8000-0000000000f1';
const EMPLOYEE = '7a000000-0000-4000-8000-0000000000e1';
const USER = '7a000000-0000-4000-8000-000000000001';
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
		{ issueEmbedSession } as any,
		{
			isAllowed: jest.fn(
				async (tenantId: string, organizationId: string, origin: string) =>
					tenantId === TENANT && organizationId === ORG && origin === SITE
			)
		} as any
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
	return { service, credentials, employees, issueEmbedSession };
}

const signIn = (tenantId: string) => jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(tenantId);

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

		const byId = await service.exchange({ credential: secret, employeeId: EMPLOYEE, origin: SITE });
		const byEmail = await service.exchange({ credential: secret, email: 'Lina@Northwind.example', origin: SITE });

		expect(byId.token).toBe('an-embed-token');
		expect(new Date(byId.expiresAt).getTime() - Date.now()).toBeGreaterThan(14 * 60 * 1000);
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
});
