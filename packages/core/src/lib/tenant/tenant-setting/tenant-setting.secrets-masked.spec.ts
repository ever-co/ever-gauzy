import '../../core/entities/internal';

import { from, lastValueFrom, Observable } from 'rxjs';
import { TenantSetting } from './tenant-setting.entity';
import { TenantSettingController } from './tenant-setting.controller';
import { TenantSettingResolver } from './tenant-setting.resolver';

/**
 * Every surface that answers settings ROWS masks the secrets (SEC-A-06).
 *
 * The settings document was masked by its handler; the rows were not. `tenantSettings` / `tenantSetting` and the
 * row edit and soft-delete pair over GraphQL, and `GET /tenant-setting/:id`, `/pagination` and the soft-delete pair
 * over REST, answered the stored S3 / Wasabi / DigitalOcean secret keys, the Cloudinary API secret and the
 * monitoring keys in cleartext.
 *
 * Each real route and field is run through the interceptors its class declares, so the wiring is what is tested.
 */

const SECRET = 'secret-access-key-value-0123456789-0123456789';
const row = (id: string, name: string, value: string, valueJson?: unknown) =>
	Object.assign(new TenantSetting(), { id, name, value, valueJson, tenantId: 't-1' });

const ROWS = [
	row('s1', 'aws_secret_access_key', SECRET),
	row('s2', 'fileStorageProvider', 'S3'),
	row('s3', 'sentryDsn', '', { dsn: 'https://public@sentry.example/1' })
];

/** What the class's declared interceptors make of what its method answered. */
async function answered(target: Function, call: () => Promise<unknown>): Promise<any> {
	const declared: Array<new () => { intercept(context: unknown, next: { handle(): Observable<unknown> }): Observable<unknown> }> =
		Reflect.getMetadata('__interceptors__', target) ?? [];

	let handle = (): Observable<unknown> => from(call());
	for (const Interceptor of [...declared].reverse()) {
		const interceptor = new Interceptor();
		const inner = handle;
		handle = () => interceptor.intercept({}, { handle: inner });
	}

	return lastValueFrom(handle());
}

function surfaces() {
	const service = {
		findAll: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length }),
		paginate: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length }),
		findOneByIdString: jest.fn().mockResolvedValue(ROWS[0]),
		softRemove: jest.fn().mockResolvedValue(ROWS[0]),
		softRecover: jest.fn().mockResolvedValue(ROWS[0]),
		update: jest.fn().mockResolvedValue({ affected: 1 })
	};
	const commandBus = { execute: jest.fn() };

	return {
		service,
		resolver: new TenantSettingResolver(service as never, commandBus as never),
		controller: new TenantSettingController(service as never, commandBus as never)
	};
}

const valuesOf = (rows: TenantSetting[]) => Object.fromEntries(rows.map((one) => [one.name, one.value]));

describe('tenant settings rows never carry a secret in cleartext (SEC-A-06)', () => {
	it('masks the secrets in the tenantSettings connection, and leaves plain settings readable', async () => {
		const { resolver } = surfaces();

		const connection = await answered(TenantSettingResolver, () => resolver.tenantSettings());
		const values = valuesOf(connection.nodes);

		// The failure scenario: `{ tenantSettings { nodes { name value } } }` answered the S3 secret key.
		expect(values['aws_secret_access_key']).not.toContain(SECRET.slice(0, 20));
		expect(values['aws_secret_access_key']).toMatch(/^\*+/);
		expect(values['fileStorageProvider']).toBe('S3');
		expect(JSON.stringify(connection.edges)).not.toContain(SECRET.slice(0, 20));
		// The structured value of a secret is masked too.
		expect(JSON.stringify(connection.nodes)).not.toContain('public@sentry');
	});

	it('masks the row answered by tenantSetting, the row edit and the soft-delete pair', async () => {
		const { resolver } = surfaces();

		for (const call of [
			() => resolver.tenantSetting('s1'),
			() => resolver.updateTenantSettingRow({ id: 's1', value: 'x' } as never),
			() => resolver.softDeleteTenantSetting('s1'),
			() => resolver.recoverTenantSetting('s1')
		]) {
			expect((await answered(TenantSettingResolver, call)).value).not.toContain(SECRET.slice(0, 20));
		}
	});

	it('masks the rows of GET /:id, /pagination and the soft-delete pair over REST', async () => {
		const { controller } = surfaces();

		expect((await answered(TenantSettingController, () => controller.findById('s1'))).value).not.toContain(SECRET.slice(0, 20));
		expect(JSON.stringify(await answered(TenantSettingController, () => controller.pagination({} as never)))).not.toContain(
			SECRET.slice(0, 20)
		);
		expect((await answered(TenantSettingController, () => controller.softRemove('s1'))).value).not.toContain(SECRET.slice(0, 20));
		expect((await answered(TenantSettingController, () => controller.softRecover('s1'))).value).not.toContain(SECRET.slice(0, 20));
	});

	it('masks the serialized rows MikroORM answers, and leaves the settings document as its handler masked it', async () => {
		// Review on #10652: under MikroORM, `CrudService.serialize()` answers `wrap(entity).toJSON()` — plain objects
		// that are not `TenantSetting` instances — and those passed the interceptor with the secret in cleartext.
		const { resolver, service } = surfaces();
		const plain = ROWS.map((one) => ({ ...one }));
		service.findAll.mockResolvedValue({ items: plain, total: plain.length });

		const connection = await answered(TenantSettingResolver, () => resolver.tenantSettings());
		expect(JSON.stringify(connection)).not.toContain(SECRET.slice(0, 20));
		expect(valuesOf(connection.nodes)['fileStorageProvider']).toBe('S3');

		// A settings document is a key / value map, not a row: it is left as its handler answered it.
		const document = { fileStorageProvider: 'S3', aws_default_region: 'eu-west-1' };
		expect(await answered(TenantSettingController, async () => document)).toEqual(document);
	});

	it('leaves the stored row untouched', async () => {
		const { resolver } = surfaces();

		await answered(TenantSettingResolver, () => resolver.tenantSetting('s1'));

		expect(ROWS[0].value).toBe(SECRET);
	});
});
