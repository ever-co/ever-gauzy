import 'reflect-metadata';
import {
	EXPORT_REDACT_METADATA,
	ExportRedacted,
	exportRedacted,
	getExportRedactedProperties,
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

	it('refuses to project a row whose entity class is unknown', () => {
		// Fail closed: not knowing which columns are secret must stop the write, not permit it.
		expect(() => redactForExport(undefined as unknown as Function, { password: 'hunter2' })).toThrow(TypeError);
	});
});
