import 'reflect-metadata';
import {
	EXPORT_REDACT_METADATA,
	ExportEntityClass,
	ExportRedacted,
	exportRedacted,
	getExportRedactedProperties,
	maskEmbeddedSecret,
	omitExportRedactionPlaceholders,
	OPAQUE_EXPORT_MASK,
	redactForExport
} from './export-redact.decorator';

/**
 * The column-level opt-in that keeps credentials out of export archives (GHSA-j5h5-r956-rxc3).
 *
 * The CSV export never runs `class-transformer`, so `@Exclude({ toPlainOnly: true })` does nothing
 * for it; these marks are the only thing standing between a stored OAuth token and a downloadable
 * file. Every "cannot decide" case below therefore has to come out on the masking side.
 */
describe('ExportRedacted', () => {
	it('is opt-in — an unmarked column is exported verbatim', () => {
		class Plain {
			host: string;
		}

		expect(getExportRedactedProperties(Plain).size).toBe(0);
		expect(redactForExport(Plain, { host: 'smtp.example.com' })).toEqual({ host: 'smtp.example.com' });
	});

	it('masks a marked column and leaves the rest alone', () => {
		class Smtp {
			@ExportRedacted()
			password: string;

			host: string;
		}

		const password = 'correct-horse-battery-staple';
		const row = Object.assign(new Smtp(), { password, host: 'smtp.example.com' });
		const redacted = redactForExport(Smtp, row);

		expect(redacted.host).toBe('smtp.example.com');
		expect(redacted.password).not.toContain('horse');
		expect(String(redacted.password)).toMatch(/^\*+/);
		expect(String(redacted.password).replace(/\*/g, '')).toBe(password.slice(-4));
	});

	it('leaves no 4-character run of a long secret in the output', () => {
		class Setting {
			@ExportRedacted()
			value: string;
		}

		// Assembled at runtime so a scanner does not read the fixture as a real credential.
		const token = ['gho', '_', 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8'].join('');
		const masked = String(redactForExport(Setting, Object.assign(new Setting(), { value: token })).value);

		for (let i = 0; i + 4 <= token.length - 4; i++) {
			expect(masked).not.toContain(token.slice(i, i + 4));
		}
		expect(masked).toHaveLength(token.length);
	});

	it('blanks instead of hinting when asked — digests gain nothing from a trailing hint', () => {
		class Account {
			@ExportRedacted({ blank: true })
			hash: string;
		}

		const bcrypt = '$2b$10$' + 'k'.repeat(53);
		expect(redactForExport(Account, Object.assign(new Account(), { hash: bcrypt })).hash).toBe('');
	});

	it('honours a per-row predicate — a non-secret name stays in cleartext', () => {
		class Setting {
			settingsName: string;

			@ExportRedacted<Setting>({ when: (it) => it.settingsName !== 'isEnabled' })
			settingsValue: string;
		}

		const secret = Object.assign(new Setting(), { settingsName: 'access_token', settingsValue: 'a'.repeat(40) });
		const flag = Object.assign(new Setting(), { settingsName: 'isEnabled', settingsValue: 'true' });

		// `maskSecret` keeps a 4-character trailing hint on values long enough to afford one.
		expect(redactForExport(Setting, secret).settingsValue).toBe('*'.repeat(36) + 'aaaa');
		expect(redactForExport(Setting, flag).settingsValue).toBe('true');
	});

	it('masks when the predicate cannot reach a verdict', () => {
		class Setting {
			@ExportRedacted({ when: () => undefined as unknown as boolean })
			maybe: string;

			@ExportRedacted({
				when: () => {
					throw new Error('cannot classify this row');
				}
			})
			exploded: string;
		}

		const row = Object.assign(new Setting(), { maybe: 'x'.repeat(30), exploded: 'y'.repeat(30) });
		const redacted = redactForExport(Setting, row);

		expect(redacted.maybe).toBe('*'.repeat(26) + 'xxxx');
		expect(redacted.exploded).toBe('*'.repeat(26) + 'yyyy');
	});

	it('leaves empty values as they are rather than inventing a masked one', () => {
		class Setting {
			@ExportRedacted()
			value?: string | null;
		}

		expect(redactForExport(Setting, Object.assign(new Setting(), { value: null })).value).toBeNull();
		expect(redactForExport(Setting, Object.assign(new Setting(), { value: '' })).value).toBe('');
	});

	it("masks a credential whose value is literally 'null' or 'undefined'", () => {
		// `isNotEmpty` reads those two strings as empty, which exported them verbatim.
		class Setting {
			@ExportRedacted()
			value: string;
		}

		expect(redactForExport(Setting, Object.assign(new Setting(), { value: 'null' })).value).toBe('****');
		expect(redactForExport(Setting, Object.assign(new Setting(), { value: 'undefined' })).value).toBe('*********');
	});

	it('writes a fixed mask for an opaque mark — neither the length nor a tail of the value', () => {
		class Smtp {
			@ExportRedacted({ opaque: true })
			password: string;
		}

		const short = redactForExport(Smtp, Object.assign(new Smtp(), { password: 'abc' })).password;
		const long = redactForExport(Smtp, Object.assign(new Smtp(), { password: 'correct-horse-battery-staple' })).password;

		expect(short).toBe(OPAQUE_EXPORT_MASK);
		expect(long).toBe(OPAQUE_EXPORT_MASK);
	});

	describe('columns that embed a secret', () => {
		class Address {
			kind: string;
			token: string | null;

			@ExportRedacted<Address>({
				when: (it) => it.kind !== 'CUSTOM_DOMAIN',
				mask: (value, it) => maskEmbeddedSecret(value, it.token)
			})
			address: string;
		}

		const token = '0123456789abcdef0123456789abcdef';

		it('masks the embedded token and keeps the rest of the value', () => {
			const row = Object.assign(new Address(), { kind: 'PLATFORM', token, address: `docs-${token}@in.example.com` });
			const redacted = String(redactForExport(Address, row).address);

			expect(redacted).not.toContain(token.slice(0, 28));
			expect(redacted).toBe(`docs-${'*'.repeat(28)}cdef@in.example.com`);
		});

		it('masks the whole value when the token cannot be located in it', () => {
			const row = Object.assign(new Address(), { kind: 'PLATFORM', token: null, address: `docs-${token}@in.example.com` });
			expect(String(redactForExport(Address, row).address)).toMatch(/^\*+.{4}$/);
		});

		it('matches the embedded token case-insensitively', () => {
			expect(maskEmbeddedSecret(`docs-${token.toUpperCase()}@x.io`, token)).toBe(`docs-${'*'.repeat(28)}cdef@x.io`);
		});

		it('leaves a row the predicate exempts untouched', () => {
			const row = Object.assign(new Address(), { kind: 'CUSTOM_DOMAIN', token: null, address: 'docs@acme.com' });
			expect(redactForExport(Address, row).address).toBe('docs@acme.com');
		});

		it('falls back to the full mask when the mask function throws', () => {
			class Broken {
				@ExportRedacted({
					mask: () => {
						throw new Error('boom');
					}
				})
				value: string;
			}
			expect(redactForExport(Broken, Object.assign(new Broken(), { value: 'v'.repeat(20) })).value).toBe(
				'*'.repeat(16) + 'vvvv'
			);
		});

		it('recognizes its output as a placeholder on re-import', () => {
			const row = Object.assign(new Address(), { kind: 'PLATFORM', token, address: `docs-${token}@in.example.com` });
			const exported = redactForExport(Address, row);

			expect(omitExportRedactionPlaceholders(Address, exported)).not.toHaveProperty('address');
		});
	});

	it('INHERITS marks — unlike @SkipExport, because more masking is the safe direction', () => {
		class Credential {
			@ExportRedacted()
			secret: string;
		}
		class ScopedCredential extends Credential {
			scope: string;
		}

		const row = Object.assign(new ScopedCredential(), { secret: 's'.repeat(20), scope: 'read' });
		const redacted = redactForExport(ScopedCredential, row);

		expect(redacted.secret).toBe('*'.repeat(16) + 'ssss');
		expect(redacted.scope).toBe('read');
	});

	it('lets a subclass override the base class mark for the same property', () => {
		class Base {
			@ExportRedacted()
			value: string;
		}
		class Child extends Base {}
		exportRedacted(Child, 'value', { blank: true });

		expect(redactForExport(Base, Object.assign(new Base(), { value: 'v'.repeat(20) })).value).toBe(
			'*'.repeat(16) + 'vvvv'
		);
		expect(redactForExport(Child, Object.assign(new Child(), { value: 'v'.repeat(20) })).value).toBe('');
	});

	it('marks a column imperatively, for entities that cannot be decorated in place', () => {
		class PluginEntity {
			apiKey: string;
		}
		exportRedacted(PluginEntity, 'apiKey');

		expect(Reflect.getOwnMetadata(EXPORT_REDACT_METADATA, PluginEntity)).toEqual([{ property: 'apiKey' }]);
		expect(
			redactForExport(PluginEntity, Object.assign(new PluginEntity(), { apiKey: 'k'.repeat(20) })).apiKey
		).toBe('*'.repeat(16) + 'kkkk');
	});

	it('drops anything that is not a persisted column when the column list is given', () => {
		// `IntegrationSettingSubscriber` attaches `wrapSecretValue` on load, and virtual columns are
		// computed; neither round-trips, and both are a way back into the archive for a value the
		// column marks never saw.
		class Setting {
			settingsName: string;

			@ExportRedacted()
			settingsValue: string;

			wrapSecretValue?: string;
		}

		const row = Object.assign(new Setting(), {
			settingsName: 'access_token',
			settingsValue: 'a'.repeat(40),
			wrapSecretValue: 'anything at all'
		});

		const redacted = redactForExport(Setting, row, ['settingsName', 'settingsValue']);

		expect(Object.keys(redacted)).toEqual(['settingsName', 'settingsValue']);
		expect(redacted).not.toHaveProperty('wrapSecretValue');
	});

	describe('omitExportRedactionPlaceholders (re-import)', () => {
		class Setting {
			settingsName: string;

			@ExportRedacted<Setting>({ when: (it) => it.settingsName !== 'isEnabled' })
			settingsValue: string;

			@ExportRedacted({ blank: true })
			hash: string | null;

			@ExportRedacted({ opaque: true })
			password: string;
		}

		it('drops exactly what the export wrote in place of each secret', () => {
			const exported = redactForExport(
				Setting,
				Object.assign(new Setting(), {
					settingsName: 'access_token',
					settingsValue: 'a'.repeat(40),
					hash: '$2b$10$' + 'k'.repeat(53),
					password: 'smtp-password-value'
				})
			);

			expect(omitExportRedactionPlaceholders(Setting, exported)).toEqual({ settingsName: 'access_token' });
		});

		it('keeps real values, and values the mark does not apply to', () => {
			const flag = { settingsName: 'isEnabled', settingsValue: '****' };
			const real = { settingsName: 'access_token', settingsValue: 'gho_real', hash: '$2b$10$abc', password: 'x' };

			// The predicate says a flag row is not a secret, so its value is data even if it looks masked.
			expect(omitExportRedactionPlaceholders(Setting, flag)).toEqual(flag);
			expect(omitExportRedactionPlaceholders(Setting, real)).toEqual(real);
		});

		it('does not mutate the row it is given', () => {
			const row = { settingsName: 'access_token', settingsValue: '********' };
			omitExportRedactionPlaceholders(Setting, row);
			expect(row).toEqual({ settingsName: 'access_token', settingsValue: '********' });
		});

		it('returns the row unchanged when the entity class is unknown', () => {
			const row = { password: '********' };
			expect(omitExportRedactionPlaceholders(undefined as unknown as ExportEntityClass, row)).toEqual(row);
		});
	});

	it('refuses to project a row whose entity class is unknown', () => {
		// Fail closed: not knowing which columns are secret must stop the write, not permit it.
		expect(() => redactForExport(undefined as unknown as ExportEntityClass, { password: 'hunter2' })).toThrow(TypeError);
	});
});
