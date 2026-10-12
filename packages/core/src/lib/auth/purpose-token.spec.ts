import { sign, verify } from 'jsonwebtoken';
import { ACCESS_TOKEN_TYPE } from '../access-token/type.token';
import { REFRESH_TOKEN_TYPE } from '../refresh-token/type.token';
import {
	isAccessTokenPayload,
	PurposeTokenError,
	signPurposeToken,
	TokenPurposeEnum,
	verifyPurposeToken
} from './purpose-token';

/**
 * Purpose-typed tokens (GHSA-28wv-vrxj-rp4q, GHSA-58x4-7mw9-gmqg).
 *
 * Every purpose-specific JWT (workspace sign-in, invoice share, estimate, invite, appointment,
 * team-join, password reset) is signed with the same JWT_SECRET. A bare `verify()` therefore
 * accepts a token of ANY kind. Each "rejects" test is paired with a CONTROL showing that the
 * pre-fix `verify(token, secret)` call accepted the very same token.
 */
describe('purpose-token', () => {
	const SECRET = 'purpose-token-spec-secret';

	const expectFailure = (fn: () => unknown, reason: string) => {
		let error: unknown;
		try {
			fn();
		} catch (e) {
			error = e;
		}
		expect(error).toBeInstanceOf(PurposeTokenError);
		expect((error as PurposeTokenError).reason).toBe(reason);
	};

	describe('signPurposeToken', () => {
		it('stamps the purpose claim, which the caller cannot override', () => {
			const token = signPurposeToken(
				TokenPurposeEnum.INVOICE_SHARE,
				{ id: 'inv-1', purpose: 'access' },
				{ secret: SECRET }
			);
			expect(verify(token, SECRET)).toMatchObject({ id: 'inv-1', purpose: 'invoice-share' });
		});

		it('signs with HS256 and honours expiresIn', () => {
			const token = signPurposeToken(
				TokenPurposeEnum.APPOINTMENT,
				{ appointmentId: 'a' },
				{ secret: SECRET, expiresIn: 60 }
			);
			const [header] = token.split('.');
			expect(JSON.parse(Buffer.from(header, 'base64url').toString()).alg).toBe('HS256');
			const payload = verify(token, SECRET) as any;
			expect(payload.exp - payload.iat).toBe(60);
		});
	});

	describe('verifyPurposeToken', () => {
		it('accepts a token of the expected purpose with its required claims', () => {
			const token = signPurposeToken(
				TokenPurposeEnum.WORKSPACE_SIGNIN,
				{ userId: 'u', email: 'a@b.c' },
				{ secret: SECRET }
			);
			expect(
				verifyPurposeToken(token, TokenPurposeEnum.WORKSPACE_SIGNIN, {
					secret: SECRET,
					requiredClaims: ['userId', 'email']
				})
			).toMatchObject({ userId: 'u', email: 'a@b.c' });
		});

		it('rejects a token minted for another purpose — CONTROL: plain verify() accepted it', () => {
			const appointment = signPurposeToken(
				TokenPurposeEnum.APPOINTMENT,
				{ appointmentId: 'a' },
				{ secret: SECRET }
			);

			// CONTROL: the pre-fix consumers only called verify(); it is happy with any purpose.
			expect(() => verify(appointment, SECRET)).not.toThrow();

			expectFailure(
				() => verifyPurposeToken(appointment, TokenPurposeEnum.WORKSPACE_SIGNIN, { secret: SECRET }),
				'purpose'
			);
		});

		it('rejects an untyped (legacy) token unless explicitly allowed', () => {
			const legacy = sign({ id: 'inv-1', organizationId: 'o', tenantId: 't' }, SECRET);
			expectFailure(
				() => verifyPurposeToken(legacy, TokenPurposeEnum.INVOICE_SHARE, { secret: SECRET }),
				'purpose'
			);
			expect(
				verifyPurposeToken(legacy, TokenPurposeEnum.INVOICE_SHARE, { secret: SECRET, allowLegacyUntyped: true })
			).toMatchObject({ id: 'inv-1' });
		});

		it('never treats an access or refresh token as a legacy purpose token', () => {
			const access = sign({ id: 'u', tenantId: 't', tokenType: ACCESS_TOKEN_TYPE }, SECRET);
			expectFailure(
				() =>
					verifyPurposeToken(access, TokenPurposeEnum.INVOICE_SHARE, {
						secret: SECRET,
						allowLegacyUntyped: true
					}),
				'purpose'
			);
		});

		it.each([
			['missing', {}],
			['undefined-valued', { userId: undefined }],
			['empty', { userId: '' }],
			['whitespace', { userId: '   ' }],
			['non-string', { userId: 42 }]
		])('rejects a %s required claim', (_label, claims) => {
			const token = signPurposeToken(
				TokenPurposeEnum.WORKSPACE_SIGNIN,
				{ email: 'a@b.c', ...claims },
				{ secret: SECRET }
			);
			expectFailure(
				() =>
					verifyPurposeToken(token, TokenPurposeEnum.WORKSPACE_SIGNIN, {
						secret: SECRET,
						requiredClaims: ['userId', 'email']
					}),
				'claims'
			);
		});

		it('reports an expired token as expired', () => {
			const token = sign({ purpose: TokenPurposeEnum.ESTIMATE, exp: Math.floor(Date.now() / 1000) - 10 }, SECRET);
			expectFailure(() => verifyPurposeToken(token, TokenPurposeEnum.ESTIMATE, { secret: SECRET }), 'expired');
		});

		it('rejects a wrong signature, garbage and empty input', () => {
			const foreign = signPurposeToken(TokenPurposeEnum.ESTIMATE, {}, { secret: 'another-secret' });
			expectFailure(() => verifyPurposeToken(foreign, TokenPurposeEnum.ESTIMATE, { secret: SECRET }), 'invalid');
			expectFailure(
				() => verifyPurposeToken('not-a-jwt', TokenPurposeEnum.ESTIMATE, { secret: SECRET }),
				'invalid'
			);
			expectFailure(() => verifyPurposeToken('', TokenPurposeEnum.ESTIMATE, { secret: SECRET }), 'invalid');
			expectFailure(
				() => verifyPurposeToken(undefined, TokenPurposeEnum.ESTIMATE, { secret: SECRET }),
				'invalid'
			);
		});

		it('pins HS256 — CONTROL: an unpinned verify() accepts an HS512 token signed with the same secret', () => {
			const hs512 = sign({ purpose: TokenPurposeEnum.ESTIMATE }, SECRET, { algorithm: 'HS512' });

			// CONTROL: without an algorithms list, jsonwebtoken accepts any HMAC variant of the secret.
			expect(() => verify(hs512, SECRET)).not.toThrow();

			expectFailure(() => verifyPurposeToken(hs512, TokenPurposeEnum.ESTIMATE, { secret: SECRET }), 'invalid');
		});

		it('rejects an unsigned (alg: none) token', () => {
			const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
			const none = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ purpose: TokenPurposeEnum.ESTIMATE })}.`;
			expectFailure(() => verifyPurposeToken(none, TokenPurposeEnum.ESTIMATE, { secret: SECRET }), 'invalid');
		});
	});

	describe('isAccessTokenPayload', () => {
		it('accepts an access token (tokenType) and a legacy untyped payload', () => {
			expect(isAccessTokenPayload({ id: 'u', tenantId: 't', tokenType: ACCESS_TOKEN_TYPE })).toBe(true);
			expect(isAccessTokenPayload({ id: 'u', tenantId: 't' })).toBe(true);
			expect(isAccessTokenPayload({ id: 'u', purpose: TokenPurposeEnum.ACCESS })).toBe(true);
		});

		it.each([
			['a password-reset token (it carries `id`)', { purpose: 'password-reset', id: 'u', tenantId: 't' }],
			['a workspace sign-in token', { purpose: 'workspace-signin', userId: 'u', email: 'a@b.c', tenantId: 't' }],
			['an invoice share token', { purpose: 'invoice-share', id: 'inv', organizationId: 'o', tenantId: 't' }],
			['a refresh token', { id: 'u', tenantId: 't', tokenType: REFRESH_TOKEN_TYPE }]
		])('rejects %s', (_label, payload) => {
			expect(isAccessTokenPayload(payload)).toBe(false);
		});

		it('rejects non-objects', () => {
			expect(isAccessTokenPayload(null)).toBe(false);
			expect(isAccessTokenPayload('token')).toBe(false);
			expect(isAccessTokenPayload([])).toBe(false);
		});
	});
});
