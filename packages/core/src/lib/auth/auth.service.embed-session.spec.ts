import '../core/entities/internal';

import { sign } from 'jsonwebtoken';
import { RequestContext } from '../core/context';
import { EMBED_CLIENT_CLAIM, EMBED_GRANT_CLAIM, readEmbedClaims } from '../embed/embed-session';
import { AuthService } from './auth.service';

/**
 * The token the embed exchange mints (`AuthService.issueEmbedSession`): it names the client of a credential limited to
 * one, and a credential of the whole organization gets the token it got before clients were written into tokens.
 */

const TENANT = '7d000000-0000-4000-8000-00000000000a';
const USER = '7d000000-0000-4000-8000-000000000001';
const ORG = '7d000000-0000-4000-8000-0000000000f1';
const EMPLOYEE = '7d000000-0000-4000-8000-0000000000e1';
const CREDENTIAL = '7d000000-0000-4000-8000-0000000000c1';
const CLIENT = '7d000000-0000-4000-8000-0000000000d1';
const SITE = 'https://portal.example.com';

/** What the exchange hands the mint, for Lina, a member of the organization. */
const MINT = {
	userId: USER,
	tenantId: TENANT,
	organizationId: ORG,
	credentialId: CREDENTIAL,
	employeeId: EMPLOYEE,
	origin: SITE,
	expiresAt: new Date('2026-11-19T15:00:00.000Z')
};

/** An AuthService whose collaborators are in memory; the minted tokens are their payloads. */
function buildAuthService() {
	const service: AuthService = Object.create(AuthService.prototype);
	const payloads: Record<string, unknown>[] = [];

	Object.assign(service, {
		ormType: 'typeorm',
		logger: { error: jest.fn(), warn: jest.fn(), log: jest.fn(), debug: jest.fn() },
		typeOrmUserRepository: {
			findOne: jest.fn(async () => ({
				id: USER,
				tenantId: TENANT,
				isActive: true,
				isArchived: false,
				role: { name: 'EMPLOYEE' }
			}))
		},
		typeOrmEmployeeRepository: { findOne: jest.fn(async () => ({ id: EMPLOYEE, organizationId: ORG })) },
		accessTokenService: {
			generate: jest.fn(async (_userId: string, payload: Record<string, unknown>) => {
				payloads.push(payload);
				return `access-${payloads.length}`;
			})
		}
	});

	return { service, payloads };
}

beforeEach(() => {
	jest.spyOn(RequestContext, 'currentRequest').mockReturnValue({ headers: {} } as any);
});

afterEach(() => jest.restoreAllMocks());

describe('AuthService.issueEmbedSession, the client of the credential', () => {
	it('names the client of a credential limited to one, as the embed guard reads it', async () => {
		const { service, payloads } = buildAuthService();

		await service.issueEmbedSession({ ...MINT, clientId: CLIENT });

		expect(payloads[0]).toMatchObject({
			embedCredentialId: CREDENTIAL,
			embedEmployeeId: EMPLOYEE,
			embedOrigin: SITE,
			[EMBED_CLIENT_CLAIM]: CLIENT
		});
		const claims = readEmbedClaims(`Bearer ${sign(payloads[0], 'any-secret')}`);
		expect(claims).toMatchObject({ credentialId: CREDENTIAL, employeeId: EMPLOYEE, clientId: CLIENT });
	});

	it('mints the same claims as before for a credential of the whole organization', async () => {
		const { service, payloads } = buildAuthService();

		await service.issueEmbedSession(MINT);
		await service.issueEmbedSession({ ...MINT, clientId: null });

		expect(payloads[0]).not.toHaveProperty(EMBED_CLIENT_CLAIM);
		expect(payloads[0]).not.toHaveProperty(EMBED_GRANT_CLAIM);
		expect(payloads[1]).toEqual(payloads[0]);
		expect(payloads[0]).toMatchObject({
			embedCredentialId: CREDENTIAL,
			embedEmployeeId: EMPLOYEE,
			embedOrigin: SITE
		});
		const claims = readEmbedClaims(`Bearer ${sign(payloads[0], 'any-secret')}`);
		expect(claims).toMatchObject({ credentialId: CREDENTIAL, clientId: null });
	});
});

describe('AuthService.issueEmbedSession, the site grant of a person', () => {
	const GRANT = '7d000000-0000-4000-8000-0000000000a9';

	it('names the grant as the credential too, so the token is held to the timer as an exchanged one is', async () => {
		const { service, payloads } = buildAuthService();

		await service.issueEmbedSession({ ...MINT, credentialId: GRANT, grantId: GRANT });

		expect(payloads[0]).toMatchObject({
			embedCredentialId: GRANT,
			embedEmployeeId: EMPLOYEE,
			embedOrigin: SITE,
			[EMBED_GRANT_CLAIM]: GRANT
		});
		expect(payloads[0]).not.toHaveProperty(EMBED_CLIENT_CLAIM);
		const claims = readEmbedClaims(`Bearer ${sign(payloads[0], 'any-secret')}`);
		expect(claims).toMatchObject({ credentialId: GRANT, grantId: GRANT, origin: SITE });
	});
});
