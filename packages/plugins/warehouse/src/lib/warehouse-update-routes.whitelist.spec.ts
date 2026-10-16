import { ArgumentMetadata, ValidationPipe } from '@nestjs/common';
import { WarehouseBinController } from './warehouse-bin/warehouse-bin.controller';
import { WarehouseZoneController } from './warehouse-zone/warehouse-zone.controller';

/**
 * `PUT /warehouse-bins/:id` and `PUT /warehouse-zones/:id` (SEC-D-12).
 *
 * Both routes typed their body as an intersection (`UpdateWarehouseBinDTO & WarehouseBinDTO`), which TypeScript
 * reflects as `Object` — so `UseValidationPipe({ whitelist: true })` validated and stripped NOTHING, and the raw body
 * reached the versioned update: `{"deletedAt": "…"}` retired a bin or zone past the BIN_HAS_CONTENT / children
 * checks (and `{"tenantId": B}` moved it into another tenant, which the core update now refuses as well).
 *
 * Each case runs the REAL pipe with the options the route declares, over the parameter type the route declares —
 * the same thing Nest does at runtime.
 */
const run = (metatype: unknown, body: Record<string, unknown>) =>
	new ValidationPipe({ transform: true, whitelist: true }).transform(body, {
		type: 'body',
		metatype
	} as ArgumentMetadata);

/** The type Nest hands the pipe for the route's `@Body()` (the second parameter, after `@Param('id')`). */
const bodyTypeOf = (controller: Function) => Reflect.getMetadata('design:paramtypes', controller.prototype, 'update')[1];

const definedKeys = (value: Record<string, unknown>) =>
	Object.keys(value)
		.filter((key) => value[key] !== undefined)
		.sort();

describe.each([
	['PUT /warehouse-bins/:id', WarehouseBinController],
	['PUT /warehouse-zones/:id', WarehouseZoneController]
])('%s validates and whitelists its body', (_route, controller) => {
	it('declares a DTO class as the body type, not a type the pipe cannot see', () => {
		expect(bodyTypeOf(controller)).not.toBe(Object);
	});

	it('drops a `deletedAt` the body smuggles in, and keeps what the route accepts', async () => {
		const body = await run(bodyTypeOf(controller), { code: 'A-01', deletedAt: '2026-10-15T00:00:00.000Z' });

		expect(definedKeys(body)).toEqual(['code']);
	});
});
