/**
 * Interface for entities that can be assigned to a manager.
 */
export interface IManagerAssignable {
	isManager?: boolean; // Manager of the organization team
	assignedAt?: Date; // Assigned At Manager of the organization team
}
