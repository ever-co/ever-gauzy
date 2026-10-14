import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DeleteResult, FindOptionsWhere, SaveOptions, UpdateResult } from 'typeorm';
import { ID, IReaction, IReactionCreateInput, IReactionUpdateInput } from '@gauzy/contracts';
import { TenantAwareCrudService } from './../core/crud/tenant-aware-crud.service';
import { IFindOneOptions } from '../core/crud/icrud.service';
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
			// The reacting employee is the caller's OWN employee record. currentEmployeeId() is
			// deliberately null for CHANGE_SELECTED_EMPLOYEE holders, so read the identity off the JWT
			// user as well; without any employee identity there is nobody to react as (update() and
			// delete() below already enforce this). A null here used to be dropped from the toggle
			// criteria, matching — and deleting — every other employee's identical reaction.
			const employeeId = RequestContext.currentEmployeeId() ?? RequestContext.currentUser()?.employeeId;
			if (!employeeId) {
				throw new BadRequestException('Employee ID not found in context');
			}
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

			// Check if a matching reaction already exists (non-throwing lookup: findOneByWhereOptions
			// raises NotFound when there is none, which turned every FIRST reaction into a 400).
			const { success, record: reaction, error: lookupError } = await this.findOneOrFailByWhereOptions(whereOptions);
			if (!success && !(lookupError instanceof NotFoundException)) {
				// Anything but "no such reaction" is a real failure — do not fall through to a duplicate create.
				throw lookupError;
			}

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

	/**
	 * Withdraws a reaction (`DELETE /reaction/:id/soft`, `softDeleteReaction`) on the terms `update` and `delete`
	 * act on: only a reaction of the caller's own employee record. See {@link assertOwnReaction}.
	 *
	 * @param id - The reaction to withdraw.
	 * @param options - Find options, passed to the base method unchanged.
	 * @param saveOptions - Save options, passed to the base method unchanged.
	 * @returns The withdrawn reaction.
	 */
	public async softRemove(id: ID, options?: IFindOneOptions<Reaction>, saveOptions?: SaveOptions): Promise<Reaction> {
		await this.assertOwnReaction(id, false);

		return super.softRemove(id, options, saveOptions);
	}

	/**
	 * Restores a withdrawn reaction (`PUT /reaction/:id/recover`, `recoverReaction`) on the same terms.
	 *
	 * @param id - The reaction to restore.
	 * @param options - Find options, passed to the base method unchanged.
	 * @param saveOptions - Save options, passed to the base method unchanged.
	 * @returns The restored reaction.
	 */
	public async softRecover(id: ID, options?: IFindOneOptions<Reaction>, saveOptions?: SaveOptions): Promise<Reaction> {
		await this.assertOwnReaction(id, true);

		return super.softRecover(id, options, saveOptions);
	}

	/**
	 * The rule `update` and `delete` apply, applied to withdrawing and restoring (owner decision 5, 2026-10-13:
	 * these routes stay equal to `update` — which states no permission, and enforces this instead).
	 *
	 * The CRUD base's scope drops the employee for a CHANGE_SELECTED_EMPLOYEE holder and falls back to the whole
	 * tenant for a caller with no employee record, so either could withdraw or restore anybody's reaction. Like
	 * `update` and `delete`, this requires the caller's own employee in the request context (refused with the
	 * same 400 when there is none) and reads the reaction with that employee stated, so another employee's answers
	 * 404 — among withdrawn rows when the act is a restoration. The refusal is raised before the base method runs,
	 * because the base rethrows whatever fails inside it as a 404.
	 *
	 * @param id - The reaction acted on.
	 * @param withDeleted - Whether the reaction is read among withdrawn rows (a restoration).
	 * @throws {BadRequestException} When the request carries no employee of the caller's own.
	 * @throws {NotFoundException} When the reaction is not the caller's own.
	 */
	private async assertOwnReaction(id: ID, withDeleted: boolean): Promise<void> {
		const employeeId = RequestContext.currentEmployeeId();
		if (!employeeId) {
			throw new BadRequestException('Employee ID not found in context');
		}

		await this.findOneByIdString(id, {
			where: { employeeId } as FindOptionsWhere<Reaction>,
			...(withDeleted ? { withDeleted: true } : {})
		});
	}
}
