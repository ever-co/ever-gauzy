import { EventSubscriber } from 'typeorm';
import { extractNameFromEmail, sluggable } from '@gauzy/utils';
import { Employee } from './employee.entity';
import { getUserDummyImage } from '../core/utils';
import { Organization, UserOrganization } from '../core/entities/internal';
import { BaseEntityEventSubscriber } from '../core/entities/subscribers/base-entity-event.subscriber';
import {
	MikroOrmEntityManager,
	MultiOrmEntityManager,
	TypeOrmEntityManager
} from '../core/entities/subscribers/entity-event-subscriber.types';

@EventSubscriber()
export class EmployeeSubscriber extends BaseEntityEventSubscriber<Employee> {
	/**
	 * Indicates that this subscriber only listen to Employee events.
	 */
	listenTo() {
		return Employee;
	}

	/**
	 * Called after an Employee entity is loaded from the database.
	 *
	 * @param entity - The loaded Employee entity.
	 * @param event - The LoadEvent associated with the entity loading.
	 */
	async afterEntityLoad(entity: Employee): Promise<void> {
		try {
			// Set fullName from the associated user's name, if available
			if (Object.prototype.hasOwnProperty.call(entity, 'user')) {
				await this.setFullName(entity);
			}

			// Set isDeleted to true if the deletedAt property is present and not null
			if (Object.prototype.hasOwnProperty.call(entity, 'deletedAt')) {
				entity.isDeleted = !!entity.deletedAt;
			}

			// Default billRateValue to 0 if it's not set or falsy
			if (Object.prototype.hasOwnProperty.call(entity, 'billRateValue')) {
				entity.billRateValue = entity.billRateValue || 0;
			}
		} catch (error) {
			// Handle or log the error as needed
			console.error('EmployeeSubscriber: An error occurred during the afterEntityLoad process:', error.message);
		}
	}

	/**
	 * Called before entity is inserted/created to the database.
	 *
	 * @param entity
	 */
	async beforeEntityCreate(entity: Employee, em?: MultiOrmEntityManager): Promise<void> {
		try {
			// Set fullName from the associated user's name, if available
			if (Object.prototype.hasOwnProperty.call(entity, 'user')) {
				await this.createSlug(entity);
			}

			// Set a default avatar image if none is provided
			entity.user.imageUrl = entity.user.imageUrl ?? getUserDummyImage(entity.user);

			// Updates the employee's status based on the start and end work dates.
			this.updateEmployeeStatus(entity, em);
		} catch (error) {
			console.error(
				'EmployeeSubscriber: An error occurred during the beforeEntityCreate process:',
				error.message
			);
		}
	}

	/**
	 * Called before the entity is updated in the database.
	 *
	 * @param entity - The employee entity to be updated.
	 */
	async beforeEntityUpdate(entity: Employee, em?: MultiOrmEntityManager): Promise<void> {
		try {
			// Updates the employee's status based on the start and end work dates.
			this.updateEmployeeStatus(entity, em);
		} catch (error) {
			console.error(
				'EmployeeSubscriber: An error occurred during the beforeEntityUpdate process:',
				error.message
			);
		}
	}
	/**
	 * Called after an entity is inserted/created in the database.
	 *
	 * @param {Employee} entity - The employee entity that was created.
	 * @param {MultiOrmEntityManager} em - The entity manager, either TypeORM's or MikroORM's.
	 */
	async afterEntityCreate(entity: Employee, em?: MultiOrmEntityManager): Promise<void> {
		try {
			if (entity) {
				await this.calculateTotalEmployees(entity, em); // Calculate and update the total number of employees for the organization
			}
		} catch (error) {
			console.error('EmployeeSubscriber: An error occurred during the afterEntityCreate process:', error.message);
		}
	}

	/**
	 * Called after an entity is removed from the database.
	 *
	 * @param {Employee} entity - The employee entity that was deleted.
	 * @param {MultiOrmEntityManager} em - The entity manager, either TypeORM's or MikroORM's.
	 */
	async afterEntityDelete(entity: Employee, em?: MultiOrmEntityManager): Promise<void> {
		try {
			if (entity) {
				await this.calculateTotalEmployees(entity, em); // Calculate and update the total number of employees for the organization
			}
		} catch (error) {
			console.error('EmployeeSubscriber: An error occurred during the afterEntityDelete process:', error);
		}
	}

	/**
	 * Creates a slug for an Employee entity based on the associated User's information.
	 * The slug is generated using the first and last name, username, or email, in that order of preference.
	 *
	 * @param {Employee} entity - The Employee entity for which to create the slug.
	 * @returns {Promise<void>} - Returns a promise indicating the completion of the slug creation process.
	 */
	async createSlug(entity: Employee): Promise<void> {
		try {
			if (!entity?.user) {
				console.error('Entity or User object is not defined.');
				return;
			}

			const { firstName, lastName, username, email } = entity.user;

			// Determine the slug based on the available fields in order of preference
			const slugSource =
				firstName?.trim() || lastName?.trim()
					? [firstName, lastName]
							.filter(Boolean)
							.map((name) => name.trim())
							.join(' ')
					: username || extractNameFromEmail(email);

			entity.profile_link = sluggable(slugSource);
		} catch (error) {
			console.error(`EmployeeSubscriber: Error creating slug for entity with id ${entity.id}: `, error);
		}
	}

	/**
	 * Calculates and updates the total number of employees for an organization.
	 * Handles both TypeORM and MikroORM environments.
	 *
	 * @param {Employee} entity - The employee entity containing organizationId and tenantId.
	 * @param {MultiOrmEntityManager} em - The entity manager, either TypeORM's or MikroORM's.
	 * @returns {Promise<void>} - Returns a promise indicating the completion of the total employee calculation.
	 */
	async calculateTotalEmployees(entity: Employee, em: MultiOrmEntityManager): Promise<void> {
		try {
			const { organizationId, tenantId } = entity;
			if (!organizationId) return; // Early return if organizationId is missing

			// Determine the total number of employees based on the ORM type
			const totalEmployees =
				em instanceof TypeOrmEntityManager
					? await em.countBy(Employee, { organizationId, tenantId })
					: await em.count(Employee, { organizationId, tenantId });

			// Update the organization with the calculated total employees
			const criteria = { id: organizationId, tenantId };
			const partialEntity = { totalEmployees };

			if (em instanceof TypeOrmEntityManager) {
				await em.update(Organization, criteria, partialEntity);
			} else {
				await em.nativeUpdate(Organization, criteria, partialEntity);
			}
		} catch (error) {
			console.error('EmployeeSubscriber: Error while updating total employee count of the organization:', error);
		}
	}

	/**
	 * Updates the employee's status and user's status based on the start and end work dates.
	 *
	 * @param {Employee} entity - The employee entity to be updated.
	 * @param {MultiOrmEntityManager} em - The entity manager used to interact with the database.
	 */
	private updateEmployeeStatus(entity: Employee, em: MultiOrmEntityManager): void {
		// Check if the employee has started or ended work
		const hasStartedWork = !!entity.startedWorkOn;
		const hasEndedWork = !!entity.endWork;

		// Update the employee's status based on the work dates
		if (hasStartedWork || hasEndedWork) {
			this.setEmployeeStatus(entity, hasStartedWork, hasEndedWork);
			this.setUserOrganizationStatus(em, entity, hasStartedWork, hasEndedWork);

			if (hasStartedWork) {
				entity.endWork = null; // Clear the end work date if the employee has started work
			}
		}
	}

	/**
	 * Sets the employee's status flags and user tracking permissions.
	 *
	 * @param {Employee} entity - The employee entity.
	 * @param {boolean} isActive - True if the employee is active; false otherwise.
	 * @param {boolean} isArchived - True if the employee is archived; false otherwise.
	 */
	private setEmployeeStatus(entity: Employee, isActive: boolean, isArchived: boolean): void {
		entity.isTrackingEnabled = isActive;
		entity.allowScreenshotCapture = isActive;
		entity.isActive = isActive;
		entity.isArchived = isArchived;
	}

	/**
	 * Sets the full name for the employee entity based on the associated user's name.
	 *
	 * @param {Employee} entity - The Employee entity whose full name needs to be set.
	 * @returns {Promise<void>} - Returns a promise indicating the completion of the operation.
	 */
	private async setFullName(entity: Employee): Promise<void> {
		if (entity?.user?.name) {
			entity.fullName = entity.user.name;
		}
	}

	/**
	 * Updates the status (active and archived) of a user organization entity based on the associated employee's details.
	 * Handles both TypeORM and MikroORM environments.
	 *
	 * @param {MultiOrmEntityManager} em - The entity manager, either TypeORM's or MikroORM's, used to interact with the database.
	 * @param {Employee} entity - The employee entity containing the user ID, organization ID, and tenant ID information.
	 * @param {boolean} isActive - The desired active status to set for the user organization.
	 * @param {boolean} isArchived - The desired archived status to set for the user organization.
	 * @returns {Promise<void>} - Returns a promise indicating the completion of the user organization status update.
	 *
	 * @throws {Error} - Logs any error that occurs during the user organization status update process.
	 */
	async setUserOrganizationStatus(
		em: MultiOrmEntityManager,
		entity: Employee,
		isActive: boolean,
		isArchived: boolean
	): Promise<void> {
		try {
			if (!entity.id) return; // Early return if entity.id is missing

			// Get the employee ID and tenant ID from the entity
			const { id, tenantId, organizationId } = entity;

			// Fetch the employee entity based on the ORM being used
			const employee =
				em instanceof TypeOrmEntityManager
					? await em.findOne(Employee, { where: { id, organizationId, tenantId } })
					: await em.findOne(Employee, { id, organizationId, tenantId });

			if (!employee) {
				console.warn('Employee or associated user not found.');
				return;
			}

			// Get the user ID from the employee
			const userId = employee.userId;

			// Update the UserOrganization status based on the ORM being used
			if (em instanceof TypeOrmEntityManager) {
				await em.update(UserOrganization, { userId, organizationId }, { isActive, isArchived });
			} else if (em instanceof MikroOrmEntityManager) {
				await em.nativeUpdate(UserOrganization, { userId, organizationId }, { isActive, isArchived });
			}
		} catch (error) {
			// Log the error if an exception occurs during the update process
			console.error('EmployeeSubscriber: Error while updating user organization as active/inactive:', error);
		}
	}
}
