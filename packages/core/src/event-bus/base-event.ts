import { ID } from '@gauzy/contracts';
import { v4 as uuidv4 } from 'uuid';

/**
 * Abstract base class for representing events in an event-driven architecture.
 */
export abstract class BaseEvent {
	/**
	 * Readonly property representing the unique ID of the event.
	 */
	public readonly id: ID;
	/**
	 * Readonly property representing the creation timestamp of the event.
	 */
	public readonly createdAt: Date;

	/**
	 * Constructor for the BaseEvent class.
	 * Initializes the `id` with a new UUID and `createdAt` with the current date and time.
	 */
	constructor() {
		this.id = uuidv4(); // Generate a new UUID
		this.createdAt = new Date();
	}
}
