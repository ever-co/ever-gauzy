import { BadRequestException, Injectable } from '@nestjs/common';
import { EventBus } from '@nestjs/cqrs';
import { BaseEntityEnum, ID, IEmployeeRecentVisit } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { TenantAwareCrudService } from '../core/crud';
import { EmployeeRecentVisitEvent } from './events/employee-recent-visit.event';
import { EmployeeRecentVisit } from './employee-recent-visit.entity';
import { MikroOrmEmployeeRecentVisitRepository } from './repository/mikro-orm-employee-recent-visit.repository';
import { TypeOrmEmployeeRecentVisitRepository } from './repository/type-orm-employee-recent-visit.repository';

@Injectable()
export class EmployeeRecentVisitService extends TenantAwareCrudService<EmployeeRecentVisit> {
	constructor(
		readonly typeOrmEmployeeRecentVisitRepository: TypeOrmEmployeeRecentVisitRepository,
		readonly mikroOrmEmployeeRecentVisitRepository: MikroOrmEmployeeRecentVisitRepository,
		private readonly _eventBus: EventBus
	) {
		super(typeOrmEmployeeRecentVisitRepository, mikroOrmEmployeeRecentVisitRepository);
	}

	/**
	 * Creates a new employee recent visit entry with the provided input, while associating it with the current employee and tenant.
	 * This method ensure that only 10 entries are stored for each employee.
	 *
	 * @param input - The data required to create an employee recent visit entry.
	 * @returns The created employee recent visit entry.
	 * @throws BadRequestException when the visit creation fails.
	 */
	async create(input: IEmployeeRecentVisit): Promise<IEmployeeRecentVisit> {
		try {
			const { entity, entityId, organizationId } = input;
			// Retrieve the current tenant ID from the request context or use the provided tenantId
			const tenantId = RequestContext.currentTenantId() ?? input.tenantId;

			// Retrieve the current employee's ID from the request context
			const employeeId = RequestContext.currentEmployeeId() ?? input.employeeId;

			// Get the current date and time
			const now = new Date();

			// 1. Check if the current entityType and entityId pair already exists for the current employee
			const existingEntry = await this.findOneByOptions({
				where: { entity, entityId, employeeId, organizationId, tenantId }
			});

			if (existingEntry) {
				// Update the visitedAt date and return the existing entry
				existingEntry.visitedAt = now;
				return await this.save(existingEntry);
			}

			// 2. Retrieve the employee recent visits for the current employee
			const employeeRecentVisits = await this.findAll({
				where: { employeeId, organizationId, tenantId },
				order: { visitedAt: 'ASC' }
			});

			// 3. If the number of entries is greater than 10, remove the oldest entry
			if (employeeRecentVisits.total >= 10) {
				// Remove the oldest entry
				const oldestEntry = employeeRecentVisits.items[0];
				await this.delete(oldestEntry.id);
			}

			// Create the employee recent visit entry using the provided input along with the employeeId and tenantId
			return await super.create({ ...input, employeeId, tenantId });
		} catch (error) {
			console.log('Error while creating employee recent visit:', error);
			throw new BadRequestException('Error while creating employee recent visit', error);
		}
	}

	// findEmployeeRecentVisits(options: IEmployeeRecentVisitFindInput): Promise<IEmployeeRecentVisit[]> {
	//     return this.typeOrmEmployeeRecentVisitRepository.find(options);
	// }

	/**
	 * Emits an event to create a new employee recent visit entry with the provided input.
	 *
	 * @param input - The data required to create an employee recent visit entry.
	 * @returns A promise that resolves with the created employee recent visit entry.
	 * @throws BadRequestException when the event emission fails.
	 */
	emitSaveEmployeeRecentVisitEvent<T>(
		entity: BaseEntityEnum,
		entityId: ID,
		data: T,
		organizationId: ID,
		tenantId: ID
	) {
		return this._eventBus.publish(
			new EmployeeRecentVisitEvent({
				entity,
				entityId,
				data,
				organizationId,
				tenantId
			})
		);
	}
}
