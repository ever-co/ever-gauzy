/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service — see
 * `favorite.resolver.spec.ts` / `channel.controller.spec.ts` for the cycle it avoids.
 */
import '../core/entities/internal';

import { BaseEntityEnum, PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { TenantAwareCrudService } from '../core/crud';
import { FAVORITABLE_TYPE } from '../core/decorators/is-favoritable';
import { EquipmentService } from '../equipment/equipment.service';
import { ExpenseService } from '../expense/expense.service';
import { IncomeService } from '../income/income.service';
import { InvoiceService } from '../invoice/invoice.service';
import { PaymentService } from '../payment/payment.service';
import { ProductService } from '../product/product.service';
import { FavoriteService } from './favorite.service';

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const INVOICE = '00000000-0000-4000-8000-000000000010';
const ESTIMATE = '00000000-0000-4000-8000-000000000011';

/**
 * More record types are favoritable (owner, 2026-10-13, handover §4.P: "Estimates, Invoices (incl.
 * received), Income/Expenses, Payments, Proposals, Contacts, Projects, Employees, Equipment, Inventory
 * items …"). A type is favoritable when its service carries `@FavoriteService(<type>)` — the favorites
 * discovery registry finds it and the details read (`GET /favorite/type`) asks it for the records.
 */
describe('favoritable record types', () => {
	it.each([
		[InvoiceService, BaseEntityEnum.Invoice],
		[ExpenseService, BaseEntityEnum.Expense],
		[IncomeService, BaseEntityEnum.Income],
		[PaymentService, BaseEntityEnum.Payment],
		[EquipmentService, BaseEntityEnum.Equipment],
		[ProductService, BaseEntityEnum.Product]
	])('%p serves the favorites of %s', (service, type) => {
		expect(Reflect.getMetadata(FAVORITABLE_TYPE, service)).toBe(type);
	});
});

/**
 * The details read has no entity permission of its own, and a favorite is created from an id alone. For
 * the types that carry business data (amounts, clients, prices) a caller must hold the type's own read
 * permission to receive the record through the favorites list.
 */
describe('FavoriteService.getFavoriteDetails', () => {
	let granted: PermissionsEnum[];
	let callMethod: jest.Mock;
	let service: FavoriteService;

	const invoice = { id: INVOICE, invoiceNumber: 12, isEstimate: false };
	const estimate = { id: ESTIMATE, invoiceNumber: 3, isEstimate: true };

	beforeEach(() => {
		granted = [];
		jest.spyOn(RequestContext, 'hasPermission').mockImplementation((permission) => granted.includes(permission));
		jest.spyOn(RequestContext, 'hasAnyPermission').mockImplementation((permissions) =>
			permissions.some((permission) => granted.includes(permission))
		);
		// The favorites themselves (the markers), as the base CRUD read would return them.
		jest.spyOn(TenantAwareCrudService.prototype, 'findAll').mockResolvedValue({
			items: [
				{ entity: BaseEntityEnum.Invoice, entityId: INVOICE },
				{ entity: BaseEntityEnum.Invoice, entityId: ESTIMATE }
			],
			total: 2
		} as any);
		callMethod = jest.fn(async () => ({ items: [invoice, estimate], total: 2 }));
		const discovery = { getService: jest.fn(() => ({ instance: {}, methods: ['findAll'] })), callMethod };
		service = new FavoriteService(discovery as any, {} as any, {} as any, {} as any);
	});

	afterEach(() => jest.restoreAllMocks());

	const read = (entity: BaseEntityEnum) =>
		service.getFavoriteDetails({ where: { entity, organizationId: ORGANIZATION, tenantId: TENANT } } as any);

	it('names an invoice after its client: the client is joined', async () => {
		granted = [PermissionsEnum.INVOICES_VIEW, PermissionsEnum.ESTIMATES_VIEW];
		await read(BaseEntityEnum.Invoice);

		expect(callMethod).toHaveBeenCalledWith(
			BaseEntityEnum.Invoice,
			'findAll',
			expect.objectContaining({ relations: ['toContact'] })
		);
	});

	it('returns invoices and estimates to a caller who may read both', async () => {
		granted = [PermissionsEnum.INVOICES_VIEW, PermissionsEnum.ESTIMATES_VIEW];

		await expect(read(BaseEntityEnum.Invoice)).resolves.toEqual({ items: [invoice, estimate], total: 2 });
	});

	it('withholds the estimates from a caller who may read invoices only, and vice versa', async () => {
		granted = [PermissionsEnum.INVOICES_VIEW];
		await expect(read(BaseEntityEnum.Invoice)).resolves.toEqual({ items: [invoice], total: 1 });

		granted = [PermissionsEnum.ESTIMATES_VIEW];
		await expect(read(BaseEntityEnum.Invoice)).resolves.toEqual({ items: [estimate], total: 1 });
	});

	it('returns no invoice at all to a caller without a read permission for them', async () => {
		granted = [PermissionsEnum.ORG_TASK_VIEW];

		await expect(read(BaseEntityEnum.Invoice)).resolves.toEqual({ items: [], total: 0 });
	});

	it.each([
		[BaseEntityEnum.Expense, PermissionsEnum.ORG_EXPENSES_VIEW],
		[BaseEntityEnum.Income, PermissionsEnum.ORG_INCOMES_VIEW],
		[BaseEntityEnum.Payment, PermissionsEnum.ORG_PAYMENT_VIEW],
		[BaseEntityEnum.Proposal, PermissionsEnum.ORG_PROPOSALS_VIEW],
		[BaseEntityEnum.Equipment, PermissionsEnum.ORG_EQUIPMENT_VIEW],
		[BaseEntityEnum.Product, PermissionsEnum.ORG_INVENTORY_VIEW]
	])('reads %s favorites only with %s', async (entity, permission) => {
		const record = { id: INVOICE };
		callMethod.mockResolvedValue({ items: [record], total: 1 });

		granted = [];
		await expect(read(entity)).resolves.toEqual({ items: [], total: 0 });

		granted = [permission];
		await expect(read(entity)).resolves.toEqual({ items: [record], total: 1 });
	});

	it('leaves the types without business data of their own as they were (a task is returned as found)', async () => {
		const task = { id: INVOICE, title: 'A task' };
		callMethod.mockResolvedValue({ items: [task], total: 1 });

		await expect(read(BaseEntityEnum.Task)).resolves.toEqual({ items: [task], total: 1 });
		expect(callMethod).toHaveBeenCalledWith(BaseEntityEnum.Task, 'findAll', { where: expect.anything() });
	});

	it('still joins an employee user only for a caller allowed to view employees', async () => {
		const employee = { id: INVOICE };
		callMethod.mockResolvedValue({ items: [employee], total: 1 });

		await read(BaseEntityEnum.Employee);
		expect(callMethod).toHaveBeenLastCalledWith(BaseEntityEnum.Employee, 'findAll', { where: expect.anything() });

		granted = [PermissionsEnum.ORG_EMPLOYEES_VIEW];
		await read(BaseEntityEnum.Employee);
		expect(callMethod).toHaveBeenLastCalledWith(
			BaseEntityEnum.Employee,
			'findAll',
			expect.objectContaining({ relations: ['user'] })
		);
	});
});
