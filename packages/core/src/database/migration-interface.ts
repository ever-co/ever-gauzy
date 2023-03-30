/**
 * @description
 * Configuration migration options for generating a new migration
 *
 */
export interface IMigrationOptions {
    /**
     * @description
     * Name of the migration class.
     * `{TIMESTAMP}-{name}.ts`.
     */

    name: string;

    /**
     * @description
     * Directory where migration should be created.
     */
    dir?: string;

    /**
     * @description
     * Name of the file with connection configuration..
     */
    config?: string;
}
