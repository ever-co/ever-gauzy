/**
 *
 */
export interface IEntityEventSubscriber<Entity> {
    /**
     * Optional method to specify the entity class that this subscriber listens to.
     * It should return either a constructor function (a class) or a string
     * representing the name of the entity.
     *
     * @returns {Function | string} The entity class or its name.
     */
    listenTo?(): Function | string;

    /**
     * Optional method that is called before an entity is created.
     * Implement this method to define specific logic to be executed
     * just before the creation of an entity
     *
     *
     * @param entity The entity that is about to be created.
     * @returns {Promise<void>}
     */
    beforeEntityCreate?(entity: Entity): Promise<void>;

    /**
     * Optional method that is called after an entity is created.
     * Implement this method to define specific logic to be executed
     * after an entity creation event.
     *
     * @param entity The entity that was created.
     * @returns {Promise<void>}
     */
    afterEntityCreate?(entity: Entity): Promise<void>;

    /**
     * Optional method that is called after an entity is loaded.
     * Implement this method to define specific logic to be executed
     * after an entity loading event.
     *
     * @param entity The entity that was loaded.
     * @returns {Promise<void>}
     */
    afterEntityLoad?(entity: Entity): Promise<void>;
}
