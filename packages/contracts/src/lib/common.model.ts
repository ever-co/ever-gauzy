/**
 * Interface for entities that can be assigned to a manager.
 */
export interface IManagerAssignable {
	isManager?: boolean; // Is Manager for the entity
	assignedAt?: Date; // Assigned At Manager for the entity
}
