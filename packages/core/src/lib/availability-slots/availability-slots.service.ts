import { ForbiddenException, Injectable } from '@nestjs/common';
import { FindOptionsWhere, In, IsNull } from 'typeorm';
import { ID, IAvailabilitySlot, IAvailabilitySlotsCreateInput, PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from './../core/context';
import { TenantAwareCrudService } from './../core/crud';
import { TypeOrmAvailabilitySlotRepository } from './repository/type-orm-availability-slot.repository';
import { MikroOrmAvailabilitySlotRepository } from './repository/mikro-orm-availability-slot.repository';
import { AvailabilitySlot } from './availability-slots.entity';

/** The members a new slot is written from, after its owner and window are decided. */
export interface IAvailabilitySlotWrite {
	startTime: Date;
	endTime: Date;
	allDay: boolean;
	type: IAvailabilitySlotsCreateInput['type'];
	organizationId?: ID | null;
	tenantId: ID;
	employeeId: ID | null;
}

@Injectable()
export class AvailabilitySlotsService extends TenantAwareCrudService<AvailabilitySlot> {
	constructor(
		typeOrmAvailabilitySlotRepository: TypeOrmAvailabilitySlotRepository,
		mikroOrmAvailabilitySlotRepository: MikroOrmAvailabilitySlotRepository
	) {
		super(typeOrmAvailabilitySlotRepository, mikroOrmAvailabilitySlotRepository);
	}

	/**
	 * Create bulk availability slots
	 *
	 * @param slots
	 * @returns
	 */
	public async createBulk(slots: IAvailabilitySlotsCreateInput[]): Promise<IAvailabilitySlot[]> {
		return await super.saveMany(slots);
	}

	/**
	 * A slot is one employee's bookable hours, so a caller who may not act for other employees and has no
	 * employee record of its own (a candidate, a viewer) reads, edits and deletes none — rather than every
	 * employee's, which is what the tenant-wide default gave it.
	 */
	protected override findConditionsWithoutOwnEmployee(): FindOptionsWhere<AvailabilitySlot> {
		return this.neverMatchingEmployeeCondition();
	}

	/**
	 * The employee a write is for.
	 *
	 * A caller with `CHANGE_SELECTED_EMPLOYEE` files for the employee it names (or for nobody in particular,
	 * when it names none). Anyone else files for themselves, whatever the body says — the same rule the
	 * recurring-expense handlers apply, and the one the Schedules page relies on, since an employee's
	 * employee selector only offers themselves. A caller with no employee record has no hours to file.
	 *
	 * @param requested The employee the body names.
	 * @returns The employee the slot belongs to.
	 * @throws ForbiddenException when the caller may not act for others and is not an employee.
	 */
	public resolveWriteEmployeeId(requested?: ID | null): ID | null {
		if (RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)) {
			return requested ?? null;
		}

		const own = RequestContext.currentEmployeeId();
		if (!own) {
			throw new ForbiddenException('Only an employee, or a user who may act for employees, can file availability.');
		}

		return own;
	}

	/**
	 * Files one slot in place of the slots it conflicts with, as one transaction.
	 *
	 * The conflicting slots used to be deleted first and the new slot saved in a separate statement, so a save
	 * the database refused left the employee with neither. Both statements now commit together or not at all.
	 * The removal is also limited to the tenant and the employee the new slot belongs to, which is whose
	 * conflicts the caller looked up.
	 *
	 * The transaction runs on TypeORM's manager whichever ORM serves reads, as the other multi-statement
	 * writes of this package do: TypeORM's mapping is complete under either ORM.
	 *
	 * The row is written from the members a slot has — never from the request body as a whole, which could
	 * name an `id` or an `employee` relation and so decide whose row it writes.
	 *
	 * @param conflictIds The slots the new one replaces.
	 * @param slot The new slot, with its window, tenant and employee already decided.
	 * @returns The stored slot.
	 */
	public async replaceSlots(conflictIds: ID[], slot: IAvailabilitySlotWrite): Promise<AvailabilitySlot> {
		const target = this.typeOrmRepository.target;
		const { startTime, endTime, allDay, type, organizationId, tenantId, employeeId } = slot;

		return await this.typeOrmRepository.manager.transaction(async (manager) => {
			if (conflictIds.length > 0) {
				await manager.delete(target, {
					id: In(conflictIds),
					tenantId,
					employeeId: employeeId ?? IsNull()
				} as FindOptionsWhere<AvailabilitySlot>);
			}

			// The scope members are stated as the CRUD service states them: the relation by its id, and the column.
			const row = manager.create(target, {
				startTime,
				endTime,
				allDay,
				type,
				organizationId: organizationId ?? null,
				tenant: { id: tenantId },
				tenantId,
				employee: employeeId ? { id: employeeId } : null,
				employeeId
			} as unknown as AvailabilitySlot);

			return (await manager.save(target, row)) as AvailabilitySlot;
		});
	}

	/**
	 * Updates a slot the caller can see.
	 *
	 * `PUT /:id` used to hand the body to `create()` with the id merged in — an upsert on ANY id of the tenant —
	 * so an employee could rewrite a colleague's slot and move it onto their own calendar. The slot is now read
	 * through the employee scope first: a slot the caller cannot read answers 404, as it does on `GET /:id`.
	 *
	 * @param id The slot.
	 * @param input The new values.
	 * @returns The stored slot.
	 */
	public async updateSlot(id: ID, input: Partial<IAvailabilitySlot>): Promise<AvailabilitySlot> {
		const existing = await this.findOneByIdString(id);
		const employeeId = this.resolveWriteEmployeeId(input.employeeId ?? existing.employeeId);

		return await this.create({ ...input, id: existing.id, employeeId } as AvailabilitySlot);
	}
}
