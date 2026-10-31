import { EventSubscriber } from 'typeorm';
import { EmployeeKindEnum } from '@gauzy/contracts';
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
import { recountMembersOfEmployeeProjects } from '../organization-project/organization-project-members-count';
import {
	readOrganizationScreenshotCapture,
	screenshotCaptureFromOrganization
} from './employee-screenshot-capture-default';

@EventSubscriber()
export class EmployeeSubscriber extends BaseEntityEventSubscriber<Employee> {
	/**
	 * The employees whose write, seen before the update, starts or ends their work or changes `isActive` /
	 * `isArchived`. Both ORMs hand the same entity object to the hooks before and after the update, which recounts
	 * their projects' members.
	 */
	private readonly workStatusChanged = new WeakSet<Employee>();

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
	 * Counts the total number of employees for an organization: people only, agent employees
	 * (`kind = 'agent'`) are not part of the headcount.
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
					// People only: an agent employee (`kind = 'agent'`) is not part of the headcount.
					return em.countBy(Employee, { organizationId, tenantId, kind: EmployeeKindEnum.HUMAN });
				}
				break;
			case MultiORMEnum.MikroORM:
				if (em instanceof MikroOrmEntityManager) {
					return em.count(Employee, { organizationId, tenantId, kind: EmployeeKindEnum.HUMAN });
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
		// What the write itself said, before the work-status rule below sets it.
		const requestedScreenshotCapture = entity.allowScreenshotCapture;
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
			await this.updateEmployeeStatus(entity, em, !!entity.startedWorkOn, !!entity.endWork);
		} catch (error) {
			console.error(
				'EmployeeSubscriber: An error occurred during the beforeEntityCreate process:',
				error.message
			);
		}

		await this.applyOrganizationScreenshotCapture(entity, em, requestedScreenshotCapture);
	}

	/**
	 * Issue #9872: when the platform sets an employee's screen capture itself — creating the employee, or starting or
	 * resuming their work — it follows the organization's setting at that moment, unless the write states a value
	 * (see `screenshotCaptureFromOrganization`). Every create path (REST, GraphQL, bulk, invite, registration,
	 * integrations, import, seeds) ends in these hooks. A stored value is never rewritten at any other moment.
	 *
	 * @param entity The employee about to be written.
	 * @param em The entity manager of the write.
	 * @param requested The value the write carried before the work-status rule; `undefined` when it states none.
	 */
	private async applyOrganizationScreenshotCapture(
		entity: Employee,
		em: MultiOrmEntityManager | undefined,
		requested: unknown
	): Promise<void> {
		try {
			if (requested !== undefined && requested !== null) return;

			const ormType = getORMType();
			const tenantId = entity.tenantId ?? entity.tenant?.id;
			// A write may omit the organization (Back to Work sends only the end date): the stored employee's then.
			const organizationId =
				entity.organizationId ??
				entity.organization?.id ??
				(em && entity.id
					? (await this.findEmployee(em, entity.id, undefined, tenantId, ormType))?.organizationId
					: undefined);
			if (!organizationId) return;

			const organizationAllows = await readOrganizationScreenshotCapture(em, organizationId, tenantId, ormType);
			const value = screenshotCaptureFromOrganization(
				requested,
				entity.allowScreenshotCapture,
				organizationAllows
			);
			if (value !== undefined) {
				entity.allowScreenshotCapture = value;
			}
		} catch (error) {
			console.error(
				'EmployeeSubscriber: Could not apply the organization screen capture setting to the employee:',
				error?.message
			);
		}
	}

	/**
	 * Called before the entity is updated in the database.
	 *
	 * @param entity - The employee entity to be updated.
	 * @param em - The entity manager, either TypeORM's or MikroORM's.
	 * @param changedProperties - The properties this write changes, or undefined when the ORM does not report them.
	 */
	async beforeEntityUpdate(
		entity: Employee,
		em?: MultiOrmEntityManager,
		changedProperties?: string[]
	): Promise<void> {
		try {
			// A work date this write leaves as stored neither starts nor ends work: edit forms send the stored
			// start date back, and under MikroORM the entity is the whole stored row.
			const isChanged = (property: string) => !changedProperties || changedProperties.includes(property);
			const hasStartedWork = !!entity.startedWorkOn && isChanged('startedWorkOn');
			const hasEndedWork = !!entity.endWork && isChanged('endWork');
			// "Back to Work" clears the stored end date: the employee resumes work.
			const hasResumedWork = entity.endWork === null && !!changedProperties?.includes('endWork');
			// Whether the write itself sets screen capture, before the work-status rule below does.
			const statesScreenshotCapture = changedProperties
				? changedProperties.includes('allowScreenshotCapture')
				: entity.allowScreenshotCapture !== undefined && entity.allowScreenshotCapture !== null;

			// Updates the employee's status based on the start and end work dates.
			await this.updateEmployeeStatus(entity, em, hasStartedWork || hasResumedWork, hasEndedWork);

			// Issue #9872: starting or resuming work turns screen capture on only where the organization allows it.
			if ((hasStartedWork || hasResumedWork) && !statesScreenshotCapture) {
				await this.applyOrganizationScreenshotCapture(entity, em, undefined);
			}

			// The flags the members count reads can also be written directly (`PUT /employee/:id` takes them), and
			// a write whose changes are not reported may carry them.
			if (hasStartedWork || hasResumedWork || hasEndedWork || isChanged('isActive') || isChanged('isArchived')) {
				this.workStatusChanged.add(entity);
			}
		} catch (error) {
			console.error(
				'EmployeeSubscriber: An error occurred during the beforeEntityUpdate process:',
				error.message
			);
		}
	}

	/**
	 * Called after the entity is updated in the database.
	 *
	 * When the write started or ended the employee's work, the members count of each of their projects is
	 * recounted: an employee whose work ended stays a member (Back to Work restores them) but is not counted.
	 *
	 * @param entity - The employee entity that was updated.
	 * @param em - The entity manager of the write, either TypeORM's or MikroORM's.
	 */
	async afterEntityUpdate(entity: Employee, em?: MultiOrmEntityManager): Promise<void> {
		try {
			if (this.workStatusChanged.delete(entity)) {
				await recountMembersOfEmployeeProjects(em, entity.id);
			}
		} catch (error) {
			console.error('EmployeeSubscriber: An error occurred during the afterEntityUpdate process:', error);
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
	 * @param {boolean} hasStartedWork - True when the write sets a start work date.
	 * @param {boolean} hasEndedWork - True when the write sets an end work date.
	 * @returns {Promise<void>} Resolves once the membership update has run, so it runs inside the write's
	 *   transaction rather than after the entity manager has committed or released it.
	 */
	private async updateEmployeeStatus(
		entity: Employee,
		em: MultiOrmEntityManager,
		hasStartedWork: boolean,
		hasEndedWork: boolean
	): Promise<void> {
		// Update the employee's status based on the work dates
		if (hasStartedWork || hasEndedWork) {
			this.setEmployeeStatus(entity, hasStartedWork, hasEndedWork);
			await this.setUserOrganizationStatus(em, entity, hasStartedWork, hasEndedWork);

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
	 * @param organizationId The organization ID; when the write omits it, the employee is matched in any organization
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
		const where = { id, tenantId, ...(organizationId ? { organizationId } : {}) };

		switch (ormType) {
			case MultiORMEnum.TypeORM:
				if (em instanceof TypeOrmEntityManager) {
					return em.findOne(Employee, { where });
				}
				break;
			case MultiORMEnum.MikroORM:
				if (em instanceof MikroOrmEntityManager) {
					return em.findOne(Employee, where);
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
		// Both keys must select the row: with a missing organizationId the (raw EntityManager) update
		// used to lose that predicate and flip the flags on EVERY organization membership of the user.
		if (!userId || !organizationId) {
			return;
		}
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

			// The stored employee's organization: a write may omit it (a TypeORM entity holds only the payload,
			// and Back to Work sends only the end date), and when it is sent the lookup above matched it.
			await this.updateUserOrganization(
				em,
				employee.userId,
				employee.organizationId,
				isActive,
				isArchived,
				ormType
			);
		} catch (error) {
			console.error('EmployeeSubscriber: Error while updating user organization as active/inactive:', error);
		}
	}
}
