import { createHash } from 'node:crypto';
import { NotFoundException } from '@nestjs/common';
import { decode, sign } from 'jsonwebtoken';
import { UserApiTokenExpiryEnum } from '@gauzy/contracts';
import { RequestContext } from '../../core/context/request-context';
import { isUserApiTokenSession, readUserApiTokenClaim, USER_API_TOKEN_CLAIM } from './user-api-token-session';
import {
	generateUserApiToken,
	hashUserApiToken,
	isUserApiTokensEnabled,
	isWellFormedUserApiToken,
	resolveUserApiTokenExpiry,
	USER_API_TOKENS_ENV,
	userApiTokenDisplayPrefix,
	userApiTokenHashesMatch
} from './user-api-token.utils';
import { UserApiTokensEnabledGuard } from './user-api-tokens-enabled.guard';

describe('the switch', () => {
	it.each([undefined, '', ' ', 'false', '0', 'no', 'off', 'nope', 'enabled'])('%p leaves API tokens off', (value) => {
		expect(isUserApiTokensEnabled(value)).toBe(false);
	});

	it.each(['true', 'TRUE', ' true ', '1', 'yes', 'on'])('%p turns API tokens on', (value) => {
		expect(isUserApiTokensEnabled(value)).toBe(true);
	});

	it('reads the environment when given nothing, so an unset server stays off', () => {
		const previous = process.env[USER_API_TOKENS_ENV];
		try {
			delete process.env[USER_API_TOKENS_ENV];
			expect(isUserApiTokensEnabled()).toBe(false);
			process.env[USER_API_TOKENS_ENV] = 'true';
			expect(isUserApiTokensEnabled()).toBe(true);
		} finally {
			if (previous === undefined) {
				delete process.env[USER_API_TOKENS_ENV];
			} else {
				process.env[USER_API_TOKENS_ENV] = previous;
			}
		}
	});

	it('the guard makes the routes answer 404 while it is off', () => {
		const previous = process.env[USER_API_TOKENS_ENV];
		try {
			delete process.env[USER_API_TOKENS_ENV];
			expect(() => new UserApiTokensEnabledGuard().canActivate()).toThrow(NotFoundException);
			process.env[USER_API_TOKENS_ENV] = 'true';
			expect(new UserApiTokensEnabledGuard().canActivate()).toBe(true);
		} finally {
			if (previous === undefined) {
				delete process.env[USER_API_TOKENS_ENV];
			} else {
				process.env[USER_API_TOKENS_ENV] = previous;
			}
		}
	});
});

describe('the token', () => {
	it('has the recognisable prefix and 256 bits of randomness', () => {
		const token = generateUserApiToken();

		expect(token.startsWith('gzp_')).toBe(true);
		expect(Buffer.from(token.slice(4), 'base64url')).toHaveLength(32);
		expect(isWellFormedUserApiToken(token)).toBe(true);
	});

	it('is different every time', () => {
		expect(new Set(Array.from({ length: 200 }, () => generateUserApiToken())).size).toBe(200);
	});

	it.each([undefined, null, 0, {}, [], '', 'gzp_', 'gzp_short', `xyz_${'a'.repeat(43)}`, `gzp_${'a'.repeat(44)}`, `gzp_${'!'.repeat(43)}`])(
		'%p is not shaped like one',
		(value) => {
			expect(isWellFormedUserApiToken(value)).toBe(false);
		}
	);

	it('stores a SHA-256 digest, and shows only its first characters', () => {
		const token = `gzp_${'a'.repeat(43)}`;

		expect(hashUserApiToken(token)).toBe(createHash('sha256').update(token).digest('hex'));
		expect(userApiTokenDisplayPrefix(token)).toBe('gzp_aaaaaaaa');
		expect(userApiTokenDisplayPrefix(token).length).toBeLessThanOrEqual(20);
	});

	it('compares digests', () => {
		const digest = hashUserApiToken('one');

		expect(userApiTokenHashesMatch(digest, digest)).toBe(true);
		expect(userApiTokenHashesMatch(digest, hashUserApiToken('two'))).toBe(false);
		expect(userApiTokenHashesMatch(null, digest)).toBe(false);
		expect(userApiTokenHashesMatch(undefined, digest)).toBe(false);
		expect(userApiTokenHashesMatch('short', digest)).toBe(false);
	});

	it('resolves each expiry', () => {
		const now = new Date('2026-11-03T00:00:00.000Z');

		expect(resolveUserApiTokenExpiry(UserApiTokenExpiryEnum.NEVER, now)).toBeNull();
		expect(resolveUserApiTokenExpiry(UserApiTokenExpiryEnum.DAYS_90, now)?.toISOString()).toBe('2027-02-01T00:00:00.000Z');
		expect(resolveUserApiTokenExpiry(UserApiTokenExpiryEnum.YEAR_1, now)?.toISOString()).toBe('2027-11-03T00:00:00.000Z');
		expect(() => resolveUserApiTokenExpiry('5y' as UserApiTokenExpiryEnum, now)).toThrow();
	});
});

describe('an API token session', () => {
	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('reads the claim only when it is a non-empty string', () => {
		expect(readUserApiTokenClaim(null)).toBeNull();
		expect(readUserApiTokenClaim('a string')).toBeNull();
		expect(readUserApiTokenClaim({})).toBeNull();
		expect(readUserApiTokenClaim({ [USER_API_TOKEN_CLAIM]: '' })).toBeNull();
		expect(readUserApiTokenClaim({ [USER_API_TOKEN_CLAIM]: 5 })).toBeNull();
		expect(readUserApiTokenClaim({ [USER_API_TOKEN_CLAIM]: 'id' })).toBe('id');
	});

	it('is told apart from an ordinary session by the bearer token', () => {
		const spy = jest.spyOn(RequestContext, 'currentToken');

		spy.mockReturnValue(null);
		expect(isUserApiTokenSession()).toBe(false);

		spy.mockReturnValue('not a token');
		expect(isUserApiTokenSession()).toBe(false);

		spy.mockReturnValue(sign({ id: 'u' }, 'secret'));
		expect(isUserApiTokenSession()).toBe(false);

		const minted = sign({ id: 'u', [USER_API_TOKEN_CLAIM]: 'token-id' }, 'secret');
		spy.mockReturnValue(minted);
		expect(decode(minted)).toHaveProperty(USER_API_TOKEN_CLAIM, 'token-id');
		expect(isUserApiTokenSession()).toBe(true);
	});

	it('does not throw when the request context cannot be read', () => {
		jest.spyOn(RequestContext, 'currentToken').mockImplementation(() => {
			throw new Error('no context');
		});

		expect(isUserApiTokenSession()).toBe(false);
	});
});
