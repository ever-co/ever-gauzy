import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DeleteResult, FindOptionsWhere, UpdateResult } from 'typeorm';
import { ID, IReaction, IReactionCreateInput, IReactionUpdateInput } from '@gauzy/contracts';
import { TenantAwareCrudService } from './../core/crud/tenant-aware-crud.service';
import { RequestContext } from '../core/context/request-context';
import { EmployeeService } from '../employee/employee.service';
import { Reaction } from './reaction.entity';
import { TypeOrmReactionRepository } from './repository/type-orm-reaction.repository';
import { MikroOrmReactionRepository } from './repository/mikro-orm-reaction.repository';

@Injectable()
export class ReactionService extends TenantAwareCrudService<Reaction> {
	constructor(
		readonly typeOrmReactionRepository: TypeOrmReactionRepository,
		readonly mikroOrmReactionRepository: MikroOrmReactionRepository,
		private readonly _employeeService: EmployeeService
	) {
		super(typeOrmReactionRepository, mikroOrmReactionRepository);
	}

	/**
	 * Creates a reaction based on the provided input. If a reaction matching the given criteria
	 * already exists, the function will delete (toggle) the reaction instead.
	 *
	 * @param input - The input data required to create a reaction.
	 * @returns A Promise resolving to the created reaction, or void if the reaction was toggled (deleted).
	 */
	async create(input: IReactionCreateInput): Promise<IReaction> {
		try {
			// Extract the tenantId from the input data or the current request context
			const tenantId = RequestContext.currentTenantId() ?? input.tenantId;
			// Extract the employeeId from the request context
			const employeeId = RequestContext.currentEmployeeId();
			// Destructure additional properties from input
			const { entity, entityId, emoji, organizationId } = input;

			// Validate employee existence
			const employee = await this._employeeService.findOneByIdString(employeeId);
			if (!employee) {
				console.error(`[Reaction Create] Employee not found with ID: ${employeeId}`);
				throw new NotFoundException('Employee not found');
			}

			// Define search criteria for an existing reaction (for toggling)
			const whereOptions: FindOptionsWhere<Reaction> = {
				emoji,
				employeeId,
				entity,
				entityId,
				tenantId,
				organizationId
			};

			// Check if a matching reaction already exists
			const reaction = await this.findOneByWhereOptions(whereOptions);

			// If a matching reaction exists, delete (toggle off) the reaction
			if (reaction) {
				await super.delete(whereOptions);
				return;
			}

			// Otherwise, create a new reaction with the provided details and additional context info
			return await super.create({
				...input,
				employeeId,
				organizationId,
				tenantId
			});
		} catch (error) {
			console.log('[Reaction Create] Error during reaction creation process:', error);
			throw new BadRequestException('Reaction post failed', error);
		}
	}

	/**
	 * Updates a reaction based on the provided id and update input.
	 * It ensures that the reaction exists and belongs to the current employee.
	 *
	 * @param id - The unique identifier of the reaction.
	 * @param input - The update data for the reaction.
	 * @returns A Promise that resolves to the updated reaction or an UpdateResult.
	 * @throws BadRequestException if the employee or tenant context is missing,
	 *         or if the reaction is not found.
	 */
	async update(id: ID, input: IReactionUpdateInput): Promise<IReaction | UpdateResult> {
		try {
			// Retrieve tenantId from the current context or fallback to the input tenantId.
			const tenantId = RequestContext.currentTenantId() ?? input.tenantId;
			if (!tenantId) {
				throw new BadRequestException('Tenant ID is missing from the request context.');
			}

			// Retrieve the current employee ID from the request context.
			const employeeId = RequestContext.currentEmployeeId();
			if (!employeeId) {
				throw new BadRequestException('Employee ID not found in context');
			}

			// Find the reaction by its ID, ensuring it belongs to the current employee.
			const reaction = await this.findOneByWhereOptions({ id, employeeId });
			if (!reaction) {
				console.error(`[ReactionUpdate] Reaction not found for id: ${id} and employeeId: ${employeeId}`);
				throw new BadRequestException('Reaction not found');
			}

			// Update the reaction using the provided input along with the employee and tenant IDs.
			return await super.update(id, { ...input, employeeId, tenantId });
		} catch (error) {
			console.error('[ReactionUpdate] Error during reaction update process:', error);
			throw new BadRequestException('Reaction update failed', error);
		}
	}

	/**
	 * Deletes a reaction by its ID, ensuring that the reaction belongs to the current employee and tenant.
	 *
	 * @param id - The unique identifier of the reaction to be deleted.
	 * @returns A Promise that resolves to the result of the deletion operation.
	 * @throws BadRequestException if the deletion fails or if the employee/tenant context is missing.
	 */
	async delete(id: ID): Promise<DeleteResult> {
		try {
			// Retrieve tenant and employee IDs from the request context.
			const tenantId = RequestContext.currentTenantId();
			if (!tenantId) {
				throw new BadRequestException('Tenant ID is missing from the request context.');
			}

			const employeeId = RequestContext.currentEmployeeId();
			if (!employeeId) {
				throw new BadRequestException('Employee ID is missing from the request context.');
			}

			// Execute the deletion using the parent class method, scoped by tenant and employee.
			return await super.delete(id, { where: { employeeId, tenantId } });
		} catch (error) {
			console.error(`[ReactionDelete] Failed to delete reaction with id: ${id}. Error:`, error);
			throw new BadRequestException('Reaction deletion failed', error);
		}
	}
}
