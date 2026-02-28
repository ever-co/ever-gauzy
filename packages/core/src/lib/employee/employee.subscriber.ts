import { EventSubscriber } from 'typeorm';
import { extractNameFromEmail, sluggable } from '@gauzy/utils';
import { Employee } from './employee.entity';
import { getORMType, getUserDummyImage, MultiORM, MultiORMEnum } from '../core/utils';
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
	 * Validates the entity manager matches the expected ORM type.
	 *
	 * @param em The entity manager to validate
	 * @param ormType The expected ORM type
	 * @returns True if the entity manager matches the expected ORM type
	 */
	private isValidEntityManager(em: MultiOrmEntityManager | undefined, ormType: MultiORM): boolean {
		if (!em) return false;

		switch (ormType) {
			case MultiORMEnum.TypeORM:
				return em instanceof TypeOrmEntityManager;
			case MultiORMEnum.MikroORM:
				return em instanceof MikroOrmEntityManager;
			default:
				return false;
		}
	}

	/**
	 * Counts the total number of employees for an organization.
	 *
	 * @param em The entity manager
	 * @param organizationId The organization ID
	 * @param tenantId The tenant ID
	 * @param ormType The ORM type
	 * @returns The total number of employees
	 */
	private async countEmployees(
		em: MultiOrmEntityManager,
		organizationId: string,
		tenantId: string,
		ormType: MultiORM
	): Promise<number> {
		switch (ormType) {
			case MultiORMEnum.TypeORM:
				if (em instanceof TypeOrmEntityManager) {
					return em.countBy(Employee, { organizationId, tenantId });
				}
				break;
			case MultiORMEnum.MikroORM:
				if (em instanceof MikroOrmEntityManager) {
					return em.count(Employee, { organizationId, tenantId });
				}
				break;
		}
		console.warn('EmployeeSubscriber: countEmployees - Entity manager type mismatch.');
		return 0;
	}

	/**
	 * Updates the organization's total employee count.
	 *
	 * @param em The entity manager
	 * @param organizationId The organization ID
	 * @param tenantId The tenant ID
	 * @param totalEmployees The total number of employees
	 * @param ormType The ORM type
	 */
	private async updateOrganizationEmployeeCount(
		em: MultiOrmEntityManager,
		organizationId: string,
		tenantId: string,
		totalEmployees: number,
		ormType: MultiORM
	): Promise<void> {
		const criteria = { id: organizationId, tenantId };
		const partialEntity = { totalEmployees };

		switch (ormType) {
			case MultiORMEnum.TypeORM:
				if (em instanceof TypeOrmEntityManager) {
					await em.update(Organization, criteria, partialEntity);
				}
				break;
			case MultiORMEnum.MikroORM:
				if (em instanceof MikroOrmEntityManager) {
					await em.nativeUpdate(Organization, criteria, partialEntity);
				}
				break;
		}
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
			if (entity.user) {
				entity.user.imageUrl = entity.user.imageUrl ?? getUserDummyImage(entity.user);
			}

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
	 * Builds a full name from first and last name parts.
	 *
	 * @param firstName The first name (optional)
	 * @param lastName The last name (optional)
	 * @returns The combined name or null if both are empty
	 */
	private buildFullName(firstName?: string, lastName?: string): string | null {
		const names = [firstName, lastName]
			.filter((name): name is string => !!name?.trim())
			.map((name) => name.trim());

		return names.length > 0 ? names.join(' ') : null;
	}

	/**
	 * Determines the slug source based on available user information.
	 * Priority: fullName > username > email
	 *
	 * @param firstName The user's first name
	 * @param lastName The user's last name
	 * @param username The user's username
	 * @param email The user's email
	 * @returns The slug source string
	 */
	private getSlugSource(firstName?: string, lastName?: string, username?: string, email?: string): string {
		// Priority 1: Use full name if available
		const fullName = this.buildFullName(firstName, lastName);
		if (fullName) {
			return fullName;
		}

		// Priority 2: Use username if available
		if (username?.trim()) {
			return username.trim();
		}

		// Priority 3: Extract name from email
		return extractNameFromEmail(email);
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
				console.error('EmployeeSubscriber: Entity or User object is not defined.');
				return;
			}

			const { firstName, lastName, username, email } = entity.user;

			// Determine the slug source based on available user information
			const slugSource = this.getSlugSource(firstName, lastName, username, email);

			// Generate and assign the slug
			entity.profile_link = sluggable(slugSource);
		} catch (error) {
			console.error(`EmployeeSubscriber: Error creating slug for entity with id ${entity.id}:`, error);
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

			// Get ORM type dynamically at runtime to ensure correct environment selection
			const ormType = getORMType();

			// Validate entity manager matches the ORM type
			if (!this.isValidEntityManager(em, ormType)) {
				console.warn('EmployeeSubscriber: Entity manager is not available or type mismatch.');
				return;
			}

			// Count total employees for the organization
			const totalEmployees = await this.countEmployees(em, organizationId, tenantId, ormType);

			// Update the organization with the calculated total employees
			await this.updateOrganizationEmployeeCount(em, organizationId, tenantId, totalEmployees, ormType);
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
	 * Fetches an employee by ID using the appropriate ORM method.
	 *
	 * @param em The entity manager
	 * @param id The employee ID
	 * @param organizationId The organization ID
	 * @param tenantId The tenant ID
	 * @param ormType The ORM type
	 * @returns The employee entity or null if not found
	 */
	private async findEmployee(
		em: MultiOrmEntityManager,
		id: string,
		organizationId: string,
		tenantId: string,
		ormType: MultiORM
	): Promise<Employee | null> {
		switch (ormType) {
			case MultiORMEnum.TypeORM:
				if (em instanceof TypeOrmEntityManager) {
					return em.findOne(Employee, { where: { id, organizationId, tenantId } });
				}
				break;
			case MultiORMEnum.MikroORM:
				if (em instanceof MikroOrmEntityManager) {
					return em.findOne(Employee, { id, organizationId, tenantId });
				}
				break;
		}
		return null;
	}

	/**
	 * Updates the user organization status.
	 *
	 * @param em The entity manager
	 * @param userId The user ID
	 * @param organizationId The organization ID
	 * @param isActive The active status
	 * @param isArchived The archived status
	 * @param ormType The ORM type
	 */
	private async updateUserOrganization(
		em: MultiOrmEntityManager,
		userId: string,
		organizationId: string,
		isActive: boolean,
		isArchived: boolean,
		ormType: MultiORM
	): Promise<void> {
		const criteria = { userId, organizationId };
		const partialEntity = { isActive, isArchived };

		switch (ormType) {
			case MultiORMEnum.TypeORM:
				if (em instanceof TypeOrmEntityManager) {
					await em.update(UserOrganization, criteria, partialEntity);
				}
				break;
			case MultiORMEnum.MikroORM:
				if (em instanceof MikroOrmEntityManager) {
					await em.nativeUpdate(UserOrganization, criteria, partialEntity);
				}
				break;
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
			if (!entity.id) {
				return;
			}

			// Get ORM type dynamically at runtime to ensure correct environment selection
			const ormType = getORMType();

			// Validate entity manager matches the ORM type
			if (!this.isValidEntityManager(em, ormType)) {
				console.warn('EmployeeSubscriber: Entity manager is not available or type mismatch.');
				return;
			}

			// Get the employee details
			const { id, tenantId, organizationId } = entity;

			// Fetch the employee entity to get the userId
			const employee = await this.findEmployee(em, id, organizationId, tenantId, ormType);

			if (!employee) {
				console.warn('EmployeeSubscriber: Employee or associated user not found.');
				return;
			}

			// Update the UserOrganization status
			await this.updateUserOrganization(em, employee.userId, organizationId, isActive, isArchived, ormType);
		} catch (error) {
			console.error('EmployeeSubscriber: Error while updating user organization as active/inactive:', error);
		}
	}
}
