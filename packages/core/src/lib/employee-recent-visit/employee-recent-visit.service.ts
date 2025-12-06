import { BadRequestException, Injectable } from '@nestjs/common';
import { EventBus } from '@nestjs/cqrs';
import { FindOptionsWhere } from 'typeorm';
import { BaseEntityEnum, ID, IEmployeeRecentVisit, IPagination } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { TenantAwareCrudService } from '../core/crud';
import { EmployeeRecentVisitEvent } from './events/employee-recent-visit.event';
import { EmployeeRecentVisit } from './employee-recent-visit.entity';
import { MikroOrmEmployeeRecentVisitRepository } from './repository/mikro-orm-employee-recent-visit.repository';
import { TypeOrmEmployeeRecentVisitRepository } from './repository/type-orm-employee-recent-visit.repository';
import { GetEmployeeRecentVisitsDTO } from './dto/get-employee-recent-visits.dto';

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
			const employeeId =
				RequestContext.currentEmployeeId() ?? RequestContext.currentUser()?.employeeId ?? input.employeeId;

			if (!employeeId) {
				throw new BadRequestException('Employee not found');
			}

			// Get the current date and time
			const now = new Date();

			// 1. Check if the current entityType and entityId pair already exists for the current employee
			const existingEntry = await this.typeOrmEmployeeRecentVisitRepository.findOne({
				where: { entity, entityId, employeeId, organizationId, tenantId }
			});

			if (existingEntry) {
				// Update the visitedAt date and return the existing entry
				existingEntry.visitedAt = now;
				return await this.save(existingEntry);
			}

			// 2. Create the employee recent visit entry using the provided input along with the employeeId and tenantId
			return await super.create({ ...input, employeeId, tenantId });
		} catch (error) {
			console.log('Error while creating employee recent visit:', error);
			throw new BadRequestException('Error while creating employee recent visit', error);
		}
	}

	/**
	 * Finds employee recent visits based on the provided filters.
	 *
	 * @param filters - The filters for finding employee recent visits.
	 * @returns A promise that resolves with the employee recent visits.
	 * @throws BadRequestException when the finding employee recent visits fails.
	 */
	async findEmployeeRecentVisits(filters: GetEmployeeRecentVisitsDTO): Promise<IPagination<IEmployeeRecentVisit>> {
		try {
			// Destructure the options
			const { organizationId, entity, entityId, relations = [] } = filters;

			// Retrieve the current tenant ID from the request context
			const tenantId = RequestContext.currentTenantId();

			// Retrieve the current employee ID from the request context
			const employeeId = RequestContext.currentEmployeeId() ?? filters.employeeId;

			// Build the where clause
			const where: FindOptionsWhere<EmployeeRecentVisit> = {
				...(organizationId && { organizationId }),
				...(entity && { entity }),
				...(entityId && { entityId }),
				tenantId,
				employeeId
			};

			const take = filters.take ? filters.take : 100; // Default take value if not provided

			// Pagination: ensure `filters.skip` is a positive integer starting from 1
			const skip = filters.skip && Number.isInteger(filters.skip) && filters.skip > 0 ? filters.skip : 1;

			// Retrieve the employee recent visits
			return await this.findAll({
				where,
				...(relations && { relations }),
				order: { visitedAt: 'DESC' },
				take,
				skip: take * (skip - 1) // Calculate offset (skip) based on validated skip value
			});
		} catch (error) {
			console.log('Error while finding employee recent visits:', error);
			throw new BadRequestException('Error while finding employee recent visits', error);
		}
	}

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
