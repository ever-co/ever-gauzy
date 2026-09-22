// Must stay first: loads the entity graph before the DTOs pull an entity (see activity.controller.spec.ts).
import '../entities/internal';

import { ArgumentMetadata, ValidationPipe } from '@nestjs/common';
import { PIPES_METADATA, ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { InvoiceStatusTypesEnum, InvoiceTypeEnum, TimeLogSourceEnum, TimeLogType } from '@gauzy/contracts';
import { UpdateInvoiceDTO } from '../../invoice/dto/update-invoice.dto';
import { CreateManualTimeLogDTO } from '../../time-tracking/time-log/dto/create-time-log.dto';
import { UpdateManualTimeLogDTO } from '../../time-tracking/time-log/dto/update-time-log.dto';
import { UpdateTimeSlotDTO } from '../../time-tracking/time-slot/dto/update-time-slot.dto';
import { InvoiceController } from '../../invoice/invoice.controller';
import { TimeLogController } from '../../time-tracking/time-log/time-log.controller';
import { TimeSlotController } from '../../time-tracking/time-slot/time-slot.controller';

/**
 * Update routes that feed create()/save()/update() with the body now run `whitelist: true`
 * (GHSA-jh6m-9fxr-rx3c: PUT /invoices/:id; GHSA-6qvm-3wg4-26w4: POST/PUT /timesheet/time-log and
 * PUT /timesheet/time-slot/:id). Whitelisting only helps if it does not silently drop what the Angular
 * and desktop clients send, so each case runs the REAL pipe over the payload those clients build and
 * checks both halves: every client field survives, and nothing else does.
 *
 * CONTROL: the same payload through the pre-fix pipe options keeps the smuggled fields.
 *
 * The payloads use `sentTo` instead of tenantId/organizationId: those two carry async ownership
 * validators that need a live request context, and are not what these cases are about.
 */

/** The keys that carry a value (declared-but-absent class fields may exist as `undefined`). */
const definedKeys = (value: Record<string, any>) =>
	Object.keys(value)
		.filter((key) => value[key] !== undefined)
		.sort();

const run = (options: ConstructorParameters<typeof ValidationPipe>[0], metatype: any, body: any) =>
	new ValidationPipe({
		...options,
		// Name the failing constraints instead of a bare "Bad Request Exception".
		exceptionFactory: (errors) =>
			new Error(JSON.stringify(errors.map(({ property, constraints, children }) => ({ property, constraints, children }))))
	}).transform(body, { type: 'body', metatype } as ArgumentMetadata);

describe('whitelisted update routes', () => {
	describe('PUT /invoices/:id — UpdateInvoiceDTO', () => {
		// What invoice-edit.component.ts sends (minus tenantId / organizationId, see above).
		const uiPayload = () => ({
			invoiceNumber: 7,
			invoiceDate: '2026-09-01T00:00:00.000Z',
			dueDate: '2026-09-30T23:59:59.999Z',
			currency: 'USD',
			discountValue: 0,
			discountType: 'PERCENT',
			tax: 0,
			tax2: 0,
			taxType: 'PERCENT',
			tax2Type: 'PERCENT',
			terms: 'net 30',
			totalValue: 100,
			invoiceType: InvoiceTypeEnum.BY_EMPLOYEE_HOURS,
			organizationContactId: 'contact-1',
			toContact: { id: 'contact-1', name: 'Client' },
			tags: [{ id: 'tag-1' }],
			status: InvoiceStatusTypesEnum.DRAFT,
			sentTo: 'org-a',
			hasRemainingAmountInvoiced: false,
			alreadyPaid: 0,
			amountDue: 100
		});

		const smuggled = {
			token: 'public-link-token',
			invoiceItems: [
				{
					id: '6c1a3b7e-8a51-4c1e-9d55-6a0f2b1c3d4e',
					price: 1,
					quantity: 1,
					totalValue: 1,
					invoiceId: 'invoice-1',
					sentTo: 'org-a',
					hacked: true
				}
			]
		};

		it('keeps every field the invoice edit screen sends', async () => {
			const result = await run({ transform: true, whitelist: true }, UpdateInvoiceDTO, uiPayload());

			expect(definedKeys(result)).toEqual(definedKeys(uiPayload()));
		});

		it('drops unknown fields, but keeps an in-place invoice item id', async () => {
			const result = await run({ transform: true, whitelist: true }, UpdateInvoiceDTO, {
				...uiPayload(),
				...smuggled
			});

			expect(result.token).toBeUndefined();
			expect(result.invoiceItems[0].id).toBe(smuggled.invoiceItems[0].id);
			expect(result.invoiceItems[0].hacked).toBeUndefined();
		});

		it('CONTROL: the pre-fix pipe keeps the smuggled fields', async () => {
			const result = await run({ transform: true }, UpdateInvoiceDTO, { ...uiPayload(), ...smuggled });

			expect(result.token).toBe('public-link-token');
			expect(result.invoiceItems[0].hacked).toBe(true);
		});
	});

	describe('POST / PUT /timesheet/time-log — manual time DTOs', () => {
		// edit-time-log-modal.component.ts: the form value plus dates, log type and source.
		const uiPayload = () => ({
			isBillable: true,
			employeeId: '2f0cbd4e-1c9d-4c34-8f7c-3c4b2f0e9a11',
			projectId: 'project-1',
			organizationContactId: 'contact-1',
			organizationTeamId: 'team-1',
			taskId: 'task-1',
			description: 'work',
			reason: 'forgot the timer',
			startedAt: new Date('2026-09-01T09:00:00Z'),
			stoppedAt: new Date('2026-09-01T10:00:00Z'),
			sentTo: 'org-a',
			logType: TimeLogType.MANUAL,
			source: TimeLogSourceEnum.WEB_TIMER
		});
		const smuggled = { isRunning: true, timesheetId: 'foreign-timesheet', id: 'some-log', timeSlots: [{ id: 'slot' }] };

		it.each([
			['PUT', UpdateManualTimeLogDTO],
			['POST', CreateManualTimeLogDTO]
		])('%s keeps every field the edit modal sends and drops the rest', async (_method, dto) => {
			const result = await run({ transform: true, whitelist: true }, dto, { ...uiPayload(), ...smuggled });

			expect(definedKeys(result)).toEqual(definedKeys(uiPayload()));
			expect(result).toMatchObject({ description: 'work', reason: 'forgot the timer', isBillable: true });
		});

		it('keeps the timer config fields (tags, version) of the web timer', async () => {
			const result = await run({ transform: true, whitelist: true }, CreateManualTimeLogDTO, {
				...uiPayload(),
				tags: ['tag-1'],
				version: '1.0.0'
			});

			expect(result).toMatchObject({ tags: ['tag-1'], version: '1.0.0' });
		});

		it('CONTROL: the pre-fix pipe keeps the smuggled fields', async () => {
			const result = await run({ transform: true }, UpdateManualTimeLogDTO, { ...uiPayload(), ...smuggled });

			expect(result).toMatchObject({ isRunning: true, timesheetId: 'foreign-timesheet', id: 'some-log' });
		});
	});

	describe('PUT /timesheet/time-slot/:id — UpdateTimeSlotDTO', () => {
		// apps/desktop app.service.ts updateToTimeSlot().
		const desktopPayload = () => ({ duration: 600, keyboard: 10, mouse: 20, overall: 30, activities: [{ title: 'x' }] });

		it('keeps what the desktop timer sends and drops tenant / organization', async () => {
			const result = await run({ whitelist: true }, UpdateTimeSlotDTO, {
				...desktopPayload(),
				tenantId: 'b',
				organizationId: 'org-b',
				timeLogs: [{ id: 'log' }]
			});

			expect(definedKeys(result)).toEqual(definedKeys(desktopPayload()));
			expect(result).toMatchObject(desktopPayload());
		});

		it('CONTROL: without whitelisting the body reaches the handler whole', async () => {
			const result = await run({}, UpdateTimeSlotDTO, { ...desktopPayload(), tenantId: 'b' });

			expect(result.tenantId).toBe('b');
		});
	});

	/**
	 * The DTO cases above only prove the DTOs are right. These prove the ROUTES actually hand their
	 * body to a whitelisting pipe — the half a refactor can silently drop.
	 */
	describe('the routes run the whitelisting pipe', () => {
		const whitelistOf = (pipes: any[] = []) =>
			pipes.find((pipe) => pipe instanceof ValidationPipe)?.['validatorOptions']?.whitelist;

		/** `@UseValidationPipe()` stores its pipe on the handler ... */
		const handlerWhitelist = (handler: (...args: any[]) => any) =>
			whitelistOf(Reflect.getMetadata(PIPES_METADATA, handler));

		/** ... while `@Body(..., new ValidationPipe())` stores it on the route argument. */
		const bodyWhitelist = (controller: any, method: string) =>
			whitelistOf(
				Object.values<any>(Reflect.getMetadata(ROUTE_ARGS_METADATA, controller, method) ?? {}).flatMap(
					(argument) => argument?.pipes ?? []
				)
			);

		it('PUT /invoices/:id and PUT /timesheet/time-slot/:id', () => {
			expect(handlerWhitelist(InvoiceController.prototype.update)).toBe(true);
			expect(handlerWhitelist(TimeSlotController.prototype.update)).toBe(true);

			// CONTROL: the same read on a route that does not whitelist, so the assertion discriminates.
			expect(handlerWhitelist(InvoiceController.prototype.create)).toBeUndefined();
		});

		it('POST and PUT /timesheet/time-log', () => {
			expect(bodyWhitelist(TimeLogController, 'addManualTime')).toBe(true);
			expect(bodyWhitelist(TimeLogController, 'updateManualTime')).toBe(true);

			// CONTROL: the pre-fix pipe of those two routes, read the same way.
			expect(whitelistOf([new ValidationPipe({ transform: true })])).toBeUndefined();
		});
	});
});
