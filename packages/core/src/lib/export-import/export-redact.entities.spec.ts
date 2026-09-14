import 'reflect-metadata';
import { getMetadataArgsStorage } from 'typeorm';
import { coreEntities } from '../core/entities';
import { CustomSmtp, EmailReset, IntegrationSetting, Invite, TenantSetting, User } from '../core/entities/internal';
import { getExportRedactedProperties, redactForExport } from './export-redact.decorator';
import { isExportSkipped } from './skip-export.decorator';

/**
 * Which credential columns the export archive must never carry in cleartext, checked against the
 * REAL entities rather than fixtures — the point of GHSA-j5h5-r956-rxc3 is that the CSV writer sees
 * the entity's own properties, so the marks have to be on the entity itself.
 */
describe('export redaction of the real entity graph', () => {
	/** Masks the way `maskSecret` does, so an expectation states the shape, not the implementation. */
	const masked = (value: string) =>
		value.length >= 12 ? '*'.repeat(value.length - 4) + value.slice(-4) : '*'.repeat(value.length);

	describe('the columns named in the advisory', () => {
		it('masks integration_setting.settingsValue for a credential and not for a flag', () => {
			const token = ['gho', '_', 'a'.repeat(36)].join('');

			const secret = Object.assign(new IntegrationSetting(), {
				settingsName: 'access_token',
				settingsValue: token
			});
			const flag = Object.assign(new IntegrationSetting(), { settingsName: 'isEnabled', settingsValue: 'true' });

			expect(redactForExport(IntegrationSetting, secret).settingsValue).toBe(masked(token));
			expect(redactForExport(IntegrationSetting, flag).settingsValue).toBe('true');
			// The setting NAME is not a secret and stays readable, so an operator can tell what to
			// re-authorize after an import.
			expect(redactForExport(IntegrationSetting, secret).settingsName).toBe('access_token');
		});

		it.each([
			['client_secret'],
			['refresh_token'],
			['accessToken'],
			['consumerSecret'],
			['apiKey'],
			['oauth_access_token'],
			['plane_api_key_value']
		])('masks integration_setting.settingsValue for %s', (settingsName) => {
			const value = 'x'.repeat(42);
			const row = Object.assign(new IntegrationSetting(), { settingsName, settingsValue: value });

			expect(redactForExport(IntegrationSetting, row).settingsValue).toBe(masked(value));
		});

		it('masks custom_smtp credentials and keeps the rest of the configuration', () => {
			const row = Object.assign(new CustomSmtp(), {
				host: 'smtp.postmarkapp.com',
				port: 587,
				secure: false,
				username: 'smtp-user-account',
				password: 'smtp-password-value'
			});

			const redacted = redactForExport(CustomSmtp, row);

			expect(redacted.host).toBe('smtp.postmarkapp.com');
			expect(redacted.port).toBe(587);
			expect(redacted.username).toBe(masked('smtp-user-account'));
			expect(redacted.password).toBe(masked('smtp-password-value'));
		});

		it('masks secret tenant settings and leaves plain configuration readable', () => {
			const secretKey = 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY';
			const rows = {
				aws_secret_access_key: secretKey,
				cloudinary_api_secret: secretKey,
				digitalocean_secret_access_key: secretKey,
				wasabi_aws_secret_access_key: secretKey,
				sentryDsn: 'https://abc123@o1.ingest.sentry.io/2',
				// unknown to every DTO — default-deny must treat it as a credential
				'docs.inboundToken': 'f'.repeat(32)
			};

			for (const [name, value] of Object.entries(rows)) {
				const row = Object.assign(new TenantSetting(), { name, value });
				expect(redactForExport(TenantSetting, row).value).toBe(masked(value));
			}

			for (const [name, value] of Object.entries({
				aws_default_region: 'eu-central-1',
				aws_bucket: 'gauzy-assets',
				fileStorageProvider: 'S3',
				posthogHost: 'https://eu.posthog.com'
			})) {
				const row = Object.assign(new TenantSetting(), { name, value });
				expect(redactForExport(TenantSetting, row).value).toBe(value);
			}
		});

		it('blanks user credential digests and keeps the profile columns', () => {
			const row = Object.assign(new User(), {
				email: 'alice@example.com',
				firstName: 'Alice',
				hash: '$2b$10$' + 'k'.repeat(53),
				refreshToken: 'r'.repeat(60),
				code: '123456',
				emailToken: 't'.repeat(40)
			});

			const redacted = redactForExport(User, row);

			expect(redacted.email).toBe('alice@example.com');
			expect(redacted.firstName).toBe('Alice');
			expect(redacted.hash).toBe('');
			expect(redacted.refreshToken).toBe('');
			expect(redacted.code).toBe(masked('123456'));
			expect(redacted.emailToken).toBe(masked('t'.repeat(40)));
		});

		it('masks live invite and e-mail-reset tokens', () => {
			const token = 'i'.repeat(64);

			const invite = Object.assign(new Invite(), { email: 'bob@example.com', token, code: '987654' });
			const reset = Object.assign(new EmailReset(), { email: 'bob@example.com', token, code: '987654' });

			expect(redactForExport(Invite, invite).token).toBe(masked(token));
			expect(redactForExport(Invite, invite).code).toBe(masked('987654'));
			expect(redactForExport(Invite, invite).email).toBe('bob@example.com');
			expect(redactForExport(EmailReset, reset).token).toBe(masked(token));
			expect(redactForExport(EmailReset, reset).code).toBe(masked('987654'));
		});
	});

	/**
	 * The regression guard. Every plugin entity is registered for export automatically, and the CSV
	 * writer has no idea what a credential is — so the next column called `…Secret` re-opens exactly
	 * the hole this advisory describes unless somebody marks it. Fail the build instead.
	 */
	describe('regression guard', () => {
		/** Words that make a column a credential wherever they appear. */
		const CREDENTIAL_WORDS = new Set([
			'secret',
			'secrets',
			'password',
			'passwd',
			'token',
			'hash',
			'credential',
			'credentials',
			'salt'
		]);

		/**
		 * Pairs that only read as a credential together. `apiKey` splits into two innocent words;
		 * `keyResult` and `licenseKey` must not be dragged in by matching `key` on its own.
		 */
		const CREDENTIAL_WORD_PAIRS = [
			['api', 'key'],
			['api', 'secret'],
			['access', 'key'],
			['secret', 'key'],
			['private', 'key'],
			['client', 'secret']
		];

		/**
		 * Words that mean the column is ABOUT a credential rather than being one: a lifetime, a
		 * discriminator, a foreign key, an expiry.
		 */
		const QUALIFIER_WORDS = new Set(['ttl', 'type', 'id', 'ids', 'expire', 'expired', 'expires', 'expiry', 'at']);

		/**
		 * Columns the pattern flags that are genuinely not credentials. Every entry needs a reason;
		 * an entry without one is how a real secret gets waved through.
		 */
		const ALLOWED: Record<string, string> = {
			'TermsAcceptance.ipHash':
				'a salted digest of an IP, kept as the audit evidence itself — masking it destroys the record it exists to be'
		};

		/** `refreshTokenTtl` -> ['refresh', 'token', 'ttl'] */
		const words = (propertyName: string): string[] =>
			propertyName
				.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
				.split(/[^a-zA-Z0-9]+/)
				.map((word) => word.toLowerCase())
				.filter(Boolean);

		it('has a mark on every credential-shaped column of every exportable entity', () => {
			// Every class reachable from the export graph, base classes included: a column declared
			// on a base class carries `target` = that base class.
			const reachable = new Set<Function>();
			for (const entity of coreEntities as unknown as Function[]) {
				if (isExportSkipped(entity)) {
					continue;
				}
				for (let cursor: any = entity; typeof cursor === 'function'; cursor = Object.getPrototypeOf(cursor)) {
					reachable.add(cursor);
				}
			}

			const unmarked: string[] = [];

			for (const column of getMetadataArgsStorage().columns) {
				const target = column.target as Function;
				if (typeof target !== 'function' || !reachable.has(target)) {
					continue;
				}

				const parts = words(column.propertyName);
				const hasPair = CREDENTIAL_WORD_PAIRS.some(([first, second]) =>
					parts.some((word, index) => word === first && parts[index + 1] === second)
				);
				const looksLikeCredential =
					(parts.some((word) => CREDENTIAL_WORDS.has(word)) || hasPair) &&
					!parts.some((word) => QUALIFIER_WORDS.has(word));

				if (!looksLikeCredential) {
					continue;
				}

				const name = `${(target as any).name}.${column.propertyName}`;
				if (name in ALLOWED) {
					continue;
				}
				if (!getExportRedactedProperties(target).has(column.propertyName)) {
					unmarked.push(name);
				}
			}

			expect(unmarked).toEqual([]);
		});

		it('still covers the two key/value columns the name pattern cannot see', () => {
			// `settingsValue` and `value` look like nothing; they hold every integration token and
			// every object-storage secret key in the product.
			expect(getExportRedactedProperties(IntegrationSetting).has('settingsValue')).toBe(true);
			expect(getExportRedactedProperties(TenantSetting).has('value')).toBe(true);
		});
	});
});
