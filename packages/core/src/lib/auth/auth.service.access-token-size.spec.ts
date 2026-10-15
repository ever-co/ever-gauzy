import '../core/entities/internal';

import { randomUUID } from 'node:crypto';
import { decode, sign } from 'jsonwebtoken';
import { PermissionsEnum, RolesEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { AuthService } from './auth.service';
import { ACCESS_TOKEN_PERMISSIONS_ENV } from './access-token-claims';

/**
 * The size of the access token every request carries.
 *
 * The token used to embed the NAME of every enabled permission of the user's role: 380 for a super admin after the
 * platform-extensions merge, an 11.5 KB token. Every request header line is capped on the way — the web image's nginx
 * at 8 KB (which made `./assets/i18n/en.json` answer 400, #10634), and Node at 16 KB for ALL request headers together —
 * and each new permission added ~30 bytes. Nothing reads the claim any more: `JwtStrategy` pins the role's CURRENT
 * permissions from the database on each request and `RequestContext.hasPermission(s)` reads those; the web app loads
 * them from `/user/me`; the desktop apps, the MCP server and Ever Teams decode `exp`, `employeeId` and `tenantId` only.
 *
 * The payload is built by the real `getJwtAccessToken()` and signed here with HS256, as the scoped token service signs
 * it (plus its `tokenType` and `jti` claims), so the size is the size a browser sends.
 */

const TENANT = '7a000000-0000-4000-8000-00000000000a';
const ORGANIZATION = '7a000000-0000-4000-8000-0000000000a1';
const USER = '7a000000-0000-4000-8000-0000000000e1';
const EMPLOYEE = '7a000000-0000-4000-8000-0000000000e2';

/** A desktop browser's user agent, which the token also carries. */
const USER_AGENT =
	// cspell:disable-next-line
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0';

/** Every permission there is, enabled — the super admin's role. */
const EVERY_PERMISSION = Object.values(PermissionsEnum);

const SUPER_ADMIN = {
	id: USER,
	tenantId: TENANT,
	isActive: true,
	isArchived: false,
	role: {
		name: RolesEnum.SUPER_ADMIN,
		rolePermissions: EVERY_PERMISSION.map((permission) => ({ permission, enabled: true }))
	}
};

/** An AuthService wired only with what `getJwtAccessToken()` touches; `generate` records the payload. */
function buildAuthService() {
	const service: AuthService = Object.create(AuthService.prototype);
	const generate = jest.fn(async (_userId: string, payload: Record<string, unknown>) =>
		sign({ ...payload, tokenType: 'access', jti: randomUUID() }, 'a-test-secret-of-realistic-length-0123456789', {
			algorithm: 'HS256',
			expiresIn: 86400
		})
	);
	Object.assign(service, {
		ormType: 'typeorm',
		logger: { error: jest.fn(), warn: jest.fn(), log: jest.fn(), debug: jest.fn() },
		typeOrmUserRepository: { findOne: jest.fn(async () => SUPER_ADMIN) },
		typeOrmEmployeeRepository: {
			findOne: jest.fn(async () => ({ id: EMPLOYEE, organizationId: ORGANIZATION }))
		},
		accessTokenService: { generate }
	});
	return { service, generate };
}

describe('AuthService.getJwtAccessToken — the access token stays small', () => {
	const previous = process.env[ACCESS_TOKEN_PERMISSIONS_ENV];

	beforeEach(() => {
		delete process.env[ACCESS_TOKEN_PERMISSIONS_ENV];
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentIp').mockReturnValue('203.0.113.42');
		jest.spyOn(RequestContext, 'currentUserAgent').mockReturnValue(USER_AGENT);
	});

	afterEach(() => {
		jest.restoreAllMocks();
		if (previous === undefined) delete process.env[ACCESS_TOKEN_PERMISSIONS_ENV];
		else process.env[ACCESS_TOKEN_PERMISSIONS_ENV] = previous;
	});

	it('does not embed the role’s permission list', async () => {
		const { service } = buildAuthService();

		const token = await service.getJwtAccessToken({ id: USER, tenantId: TENANT }, ORGANIZATION);

		expect(decode(token)).not.toHaveProperty('permissions');
	});

	it('keeps a super admin’s token under 2 KB, far from the 8 KB / 16 KB header caps', async () => {
		const { service } = buildAuthService();

		const token = await service.getJwtAccessToken({ id: USER, tenantId: TENANT }, ORGANIZATION);

		// The failure scenario: 11,464 bytes for the 380 permissions of a super admin.
		expect(Buffer.byteLength(`Bearer ${token}`)).toBeLessThan(2048);
	});

	it('still carries the claims its readers use', async () => {
		const { service } = buildAuthService();

		const token = await service.getJwtAccessToken({ id: USER, tenantId: TENANT }, ORGANIZATION);

		expect(decode(token)).toEqual(
			expect.objectContaining({
				id: USER,
				tenantId: TENANT,
				organizationId: ORGANIZATION,
				employeeId: EMPLOYEE,
				role: RolesEnum.SUPER_ADMIN,
				exp: expect.any(Number)
			})
		);
	});

	it('embeds the list again when JWT_ACCESS_TOKEN_INCLUDE_PERMISSIONS=true, for an integration that still reads it', async () => {
		process.env[ACCESS_TOKEN_PERMISSIONS_ENV] = 'true';
		const { service } = buildAuthService();

		const token = await service.getJwtAccessToken({ id: USER, tenantId: TENANT }, ORGANIZATION);

		expect((decode(token) as Record<string, unknown>).permissions).toEqual(EVERY_PERMISSION);
	});
});
