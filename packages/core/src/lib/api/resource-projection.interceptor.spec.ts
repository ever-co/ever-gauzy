import { CallHandler, ExecutionContext } from '@nestjs/common';
import { PermissionsEnum } from '@gauzy/contracts';
import { firstValueFrom, of } from 'rxjs';
import { FieldVisibility } from './field-visibility.service';
import { ResourceProjectionInterceptor } from './resource-projection.interceptor';
import { VisibleWith } from './visible-with.decorator';

/** A fixture resource: the platform's conventions do not depend on which domain declares them. */
class CostedLine {
	id = 'c1f0a9d2-0000-4000-8000-000000000001';
	sku = 'FS-400-GR';
	quantity = 2;

	@VisibleWith(PermissionsEnum.INVOICES_VIEW)
	unitCost?: number;
}

/** The write side of the same declaration: a DTO that carries a gated field. */
class CostedLineWriteDTO {
	sku?: string;

	@VisibleWith(PermissionsEnum.INVOICES_EDIT)
	unitCost?: number;
}

/** A relation row, so the walk into an expanded relation is covered. */
class CostedLineHolder {
	id = 'b71a0c94-0000-4000-8000-000000000002';
	lines: CostedLine[] = [];
}

const visibilityFor = (granted: PermissionsEnum[]): FieldVisibility =>
	({ canSee: (permission: PermissionsEnum) => granted.includes(permission) }) as unknown as FieldVisibility;

const httpContext = (request: unknown): ExecutionContext =>
	({
		getType: () => 'http',
		switchToHttp: () => ({ getRequest: () => request, getResponse: () => ({}) })
	}) as unknown as ExecutionContext;

const returning = (value: unknown): CallHandler => ({ handle: () => of(value) }) as CallHandler;

const run = async (interceptor: ResourceProjectionInterceptor, request: unknown, value: unknown) =>
	firstValueFrom(interceptor.intercept(httpContext(request), returning(value)));

const lineWithCost = (unitCost: number): CostedLine => Object.assign(new CostedLine(), { unitCost });

describe('ResourceProjectionInterceptor', () => {
	it('removes the gated field for a caller without the permission', async () => {
		const projected = (await run(new ResourceProjectionInterceptor(visibilityFor([])), {}, [
			lineWithCost(12.5)
		])) as CostedLine[];

		// The key is absent, not null: a caller must not be able to tell a withheld value from a field
		// the resource does not have.
		expect(Object.prototype.hasOwnProperty.call(projected[0], 'unitCost')).toBe(false);
		expect('unitCost' in projected[0]).toBe(false);
		expect(JSON.stringify(projected)).not.toContain('12.5');
		expect(projected[0].sku).toBe('FS-400-GR');
	});

	it('keeps the gated field for a caller with the permission', async () => {
		const projected = (await run(
			new ResourceProjectionInterceptor(visibilityFor([PermissionsEnum.INVOICES_VIEW])),
			{},
			[lineWithCost(12.5)]
		)) as CostedLine[];

		expect(projected[0].unitCost).toBe(12.5);
	});

	it('projects a row inside an expanded relation', async () => {
		const holder = Object.assign(new CostedLineHolder(), { lines: [lineWithCost(9.25)] });
		const projected = (await run(new ResourceProjectionInterceptor(visibilityFor([])), {}, holder)) as CostedLineHolder;

		expect(projected.lines[0].unitCost).toBeUndefined();
		expect(Object.prototype.hasOwnProperty.call(projected.lines[0], 'unitCost')).toBe(false);
	});

	it('leaves a response with no gated field untouched', async () => {
		const projected = (await run(new ResourceProjectionInterceptor(visibilityFor([])), {}, {
			items: [{ id: 'x', title: 'A title' }],
			total: 1
		})) as { items: { id: string; title: string }[]; total: number };

		expect(projected).toEqual({ items: [{ id: 'x', title: 'A title' }], total: 1 });
	});

	it('answers 403 when the selection names a withheld field', async () => {
		const interceptor = new ResourceProjectionInterceptor(visibilityFor([]));
		const request = { apiQuery: { fields: ['id', 'unitCost'] } };

		await expect(run(interceptor, request, [lineWithCost(12.5)])).rejects.toMatchObject({
			code: 'PERMISSION_DENIED',
			details: { field: 'unitCost', requiredPermission: PermissionsEnum.INVOICES_VIEW, resource: 'costedLine' }
		});
	});

	it('serves a selection of a gated field to a caller that holds the permission', async () => {
		const interceptor = new ResourceProjectionInterceptor(visibilityFor([PermissionsEnum.INVOICES_VIEW]));
		const request = { apiQuery: { fields: ['id', 'unitCost'] } };

		const projected = (await run(interceptor, request, [lineWithCost(12.5)])) as CostedLine[];

		expect(projected[0].unitCost).toBe(12.5);
	});

	it('refuses a write body that carries a gated field the caller may not set', async () => {
		const interceptor = new ResourceProjectionInterceptor(visibilityFor([PermissionsEnum.INVOICES_VIEW]));
		const body = Object.assign(new CostedLineWriteDTO(), { sku: 'FS-400-GR', unitCost: 12.5 });

		await expect(run(interceptor, { body }, { ok: true })).rejects.toMatchObject({
			code: 'PERMISSION_DENIED',
			details: { field: 'unitCost', requiredPermission: PermissionsEnum.INVOICES_EDIT }
		});
	});

	it('does not refuse a body that leaves an optional gated field unset', async () => {
		const interceptor = new ResourceProjectionInterceptor(visibilityFor([]));
		const body = Object.assign(new CostedLineWriteDTO(), { sku: 'FS-400-GR' });

		const response = (await run(interceptor, { body }, { ok: true })) as { ok: boolean };

		expect(response.ok).toBe(true);
	});
});
