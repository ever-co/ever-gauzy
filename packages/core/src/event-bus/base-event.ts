/**
 * Abstract base class for representing events in an event-driven architecture.
 */
export abstract class BaseEvent {
    /**
     * Readonly property representing the creation timestamp of the event.
     */
    public readonly createdAt: Date;

    /**
     * Constructor for the BaseEvent class.
     * Initializes the `createdAt` property with the current date and time.
     */
    constructor() {
        this.createdAt = new Date();
    }
}
