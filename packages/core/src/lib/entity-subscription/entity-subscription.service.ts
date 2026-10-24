import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DeleteResult, FindOptionsWhere, SaveOptions, UpdateResult } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import {
	ID,
	IEntitySubscription,
	IEntitySubscriptionCreateInput,
	IEntitySubscriptionFindInput
} from '@gauzy/contracts';
import { TenantAwareCrudService } from './../core/crud';
import { IFindOneOptions } from '../core/crud/icrud.service';
import { RequestContext } from '../core/context';
import { assertCallerIsAuthorOrTenantAdmin, isCallerTenantAdmin, withoutAuthorChange } from '../shared/ownership';
import { Employee } from './../core/entities/internal';
import { EntitySubscription } from './entity-subscription.entity';
import { MikroOrmEntitySubscriptionRepository } from './repository/mikro-orm-entity-subscription.repository';
import { TypeOrmEntitySubscriptionRepository } from './repository/type-orm-entity-subscription.repository';

@Injectable()
export class EntitySubscriptionService extends TenantAwareCrudService<EntitySubscription> {
	constructor(
		readonly typeOrmEntitySubscriptionRepository: TypeOrmEntitySubscriptionRepository,
		readonly mikroOrmEntitySubscriptionRepository: MikroOrmEntitySubscriptionRepository
	) {
		super(typeOrmEntitySubscriptionRepository, mikroOrmEntitySubscriptionRepository);
	}

	/**
	 * Creates a new subscription for the specified entity and user.
	 *
	 * @param {IEntitySubscriptionCreateInput} input - The input object containing subscription details, including the entity type, entity ID, and optional tenant ID.
	 * @returns {Promise<IEntitySubscription>} A promise resolving to the created subscription, or the existing subscription if it already exists.
	 * @throws {BadRequestException} Throws a BadRequestException if the subscription creation fails due to an error.
	 */
	async create(input: IEntitySubscriptionCreateInput): Promise<IEntitySubscription> {
		try {
			// Extract the tenant ID from the request context
			const tenantId = RequestContext.currentTenantId() ?? input.tenantId;
			// The subscription belongs to the employee named in the input (a mentioned or assigned employee);
			// only when none is given does it fall back to the current user. It used to always take the
			// current user, so every mention / assignment subscription went to the author instead.
			const currentEmployeeId = RequestContext.currentUser()?.employeeId;
			const employeeId = input.employeeId ?? currentEmployeeId;
			// Extract the entity ID and type from the input
			const { entity, entityId, organizationId } = input;

			// Mention ids come from request bodies: another employee may only be subscribed when they
			// belong to the current tenant / organization
			const forAnotherEmployee = !!employeeId && employeeId !== currentEmployeeId;
			if (forAnotherEmployee) {
				await this.assertEmployeeInScope(employeeId, tenantId, organizationId);
			}

			// For a caller without CHANGE_SELECTED_EMPLOYEE (EMPLOYEE / MANAGER roles) the employee filter (lookup)
			// and TenantAwareCrudService.create (insert) both swap the named employee for the caller. The employee
			// was checked above, so act for them explicitly.
			const asNamedEmployee = <R>(callback: () => Promise<R>): Promise<R> =>
				forAnotherEmployee ? this.withoutEmployeeFilter(callback) : callback();

			// Check if the subscription already exists
			try {
				const entitySubscription = await asNamedEmployee(() =>
					this.findOneByOptions({
						where: { employeeId, entity, entityId, organizationId, tenantId }
					})
				);
				if (entitySubscription) {
					return entitySubscription;
				}
			} catch (e) {}

			// Create a new subscription if none exists
			const subscription = await asNamedEmployee(() => super.create({ ...input, employeeId, tenantId }));

			/**
			 * TODO : Optional subscription notification if needed
			 */
			return subscription;
		} catch (error) {
			console.log('Error creating subscription:', error);
			throw new BadRequestException('Failed to create subscription', error);
		}
	}

	/**
	 * Rejects an employee who is not part of the given tenant / organization.
	 */
	private async assertEmployeeInScope(employeeId: ID, tenantId: ID, organizationId?: ID): Promise<void> {
		const exists = await this.typeOrmRepository.manager.getRepository(Employee).existsBy({
			id: employeeId,
			tenantId,
			...(organizationId ? { organizationId } : {})
		});
		if (!exists) {
			throw new ForbiddenException('The employee does not belong to this organization');
		}
	}

	/**
	 * Unsubscribes a user from a specific entity by deleting the corresponding subscription.
	 *
	 * @param {ID} id - The unique identifier of the subscription to delete.
	 * @param {IEntitySubscriptionFindInput} options - Additional options to refine the deletion query.
	 *   - `entity`: The type of entity the subscription is associated with (e.g., "project").
	 *   - `entityId`: The unique identifier of the associated entity.
	 * @returns {Promise<DeleteResult>} A promise that resolves to the result of the delete operation.
	 *
	 * @throws {BadRequestException} Throws an exception if an error occurs during the unsubscribe process.
	 */
	async unsubscribe(id: ID, input?: IEntitySubscriptionFindInput): Promise<DeleteResult> {
		try {
			// Only the subscriber, or a tenant administrator, may remove a subscription ({@link assertCallerMayChange}).
			// The criterion below pinned the caller's employee, but a caller with no employee record has none to pin:
			// the key was dropped and any subscription of the tenant was removed by its id.
			await this.assertCallerMayChange(id, true);
			const tenantAdmin = isCallerTenantAdmin();

			// Extract the tenant ID from the request context
			const tenantId = RequestContext.currentTenantId() ?? input.tenantId;
			// Extract the user from the request context
			const user = RequestContext.currentUser();
			// Extract the employee ID from the user
			const employeeId = user.employeeId;
			// Extract the entity ID and type from the input
			const { entity, entityId, organizationId } = input;
			// Delete the subscription: the caller's own, or — for a tenant administrator — whoever's it is
			return await super.delete(id, {
				where: {
					entity,
					entityId,
					...(tenantAdmin ? {} : { employeeId }),
					organizationId,
					tenantId
				}
			});
		} catch (error) {
			// A refused removal, or a subscription that is not there, keeps its status
			if (error instanceof ForbiddenException || error instanceof NotFoundException) {
				throw error;
			}
			console.log(`Error unsubscribing employee from entity: ${error}`);
			throw new BadRequestException('Failed to unsubscribing employee from entity', error);
		}
	}

	/**
	 * Deletes the subscriptions matching `where` for the employee named in it, whoever the caller is.
	 *
	 * `delete()` restricts a caller without CHANGE_SELECTED_EMPLOYEE to their own employee, and that
	 * restriction is merged over the given `employeeId`. So a team manager removing another member never
	 * reached that member's subscription: the delete was pointed at the manager's own row instead.
	 * Callers must already have checked that they may act on that employee, as the team services do.
	 *
	 * @param where - The subscription to delete, including the `employeeId` it belongs to.
	 */
	async deleteForEmployee(where: IEntitySubscriptionFindInput & { employeeId: ID }): Promise<DeleteResult> {
		// With the employee filter off, a missing employeeId would be dropped from the criteria and delete
		// every member's subscription to the entity.
		if (!where?.employeeId) {
			throw new BadRequestException('An employee is required to delete their subscription');
		}
		return await this.withoutEmployeeFilter(() => this.delete(where));
	}

	/**
	 * Changes a subscription (`PUT /entity-subscription/:id`, `updateEntitySubscription`), if it is the caller's or
	 * the caller administers the tenant ({@link assertCallerMayChange}). The patch cannot hand it to another
	 * employee ({@link withoutAuthorChange}).
	 *
	 * @param id - The subscription's id, or criteria.
	 * @param input - The columns to write.
	 * @returns The update result, or the updated row, whichever the ORM answers.
	 */
	public async update(
		id: ID | FindOptionsWhere<EntitySubscription>,
		input: QueryDeepPartialEntity<EntitySubscription>
	): Promise<EntitySubscription | UpdateResult> {
		if (typeof id === 'string') {
			await this.assertCallerMayChange(id, false);
		}

		return super.update(id, withoutAuthorChange(input, ['employeeId', 'employee']));
	}

	/**
	 * Withdraws a subscription (`DELETE /entity-subscription/:id/soft`, `softDeleteEntitySubscription`), if it is the
	 * caller's or the caller administers the tenant.
	 *
	 * @param id - The subscription to withdraw.
	 * @param options - Find options, passed to the base method unchanged.
	 * @param saveOptions - Save options, passed to the base method unchanged.
	 * @returns The withdrawn subscription.
	 */
	public async softRemove(
		id: ID,
		options?: IFindOneOptions<EntitySubscription>,
		saveOptions?: SaveOptions
	): Promise<EntitySubscription> {
		await this.assertCallerMayChange(id, false);

		return super.softRemove(id, options, saveOptions);
	}

	/**
	 * Restores a withdrawn subscription (`PUT /entity-subscription/:id/recover`, `recoverEntitySubscription`), if it
	 * is the caller's or the caller administers the tenant.
	 *
	 * @param id - The subscription to restore.
	 * @param options - Find options, passed to the base method unchanged.
	 * @param saveOptions - Save options, passed to the base method unchanged.
	 * @returns The restored subscription.
	 */
	public async softRecover(
		id: ID,
		options?: IFindOneOptions<EntitySubscription>,
		saveOptions?: SaveOptions
	): Promise<EntitySubscription> {
		await this.assertCallerMayChange(id, true);

		return super.softRecover(id, options, saveOptions);
	}

	/**
	 * Who may change a subscription through its routes: the employee it belongs to (`employeeId` — the subscriber,
	 * not `createdByUserId`, which for a mention's subscription is the author of the mention), or a tenant
	 * administrator (owner decision 2, 2026-10-22). The subscription routes state no permission, so before this any
	 * member of the tenant could rewrite, withdraw or restore another member's subscription; a caller without
	 * `CHANGE_SELECTED_EMPLOYEE` was held to their own employee's rows by the CRUD base, but a holder of it, or a
	 * caller with no employee record, was not.
	 *
	 * The services that remove a member's subscriptions when the member leaves a team, a project or a sprint go
	 * through {@link deleteForEmployee}, after their own checks, and are not affected.
	 *
	 * The read is the tenant-scoped one, so a subscription of another tenant, or one that is not there, is a 404.
	 *
	 * @param id - The subscription's id.
	 * @param withDeleted - Whether a withdrawn subscription counts (a recovery, and a removal, act on one).
	 * @throws ForbiddenException when the subscription is not the caller's and the caller does not administer the
	 * tenant.
	 */
	private async assertCallerMayChange(id: ID, withDeleted: boolean): Promise<void> {
		if (isCallerTenantAdmin()) {
			return;
		}

		const subscription = await this.findOneByIdString(id, withDeleted ? { withDeleted: true } : undefined);
		assertCallerIsAuthorOrTenantAdmin({ employeeId: subscription.employeeId }, 'a subscription');
	}
}
