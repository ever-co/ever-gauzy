import { IColumn } from 'angular2-smart-table';

/**
 * @description
 * Type representing the possible page data table locations for dynamic table columns.
 *
 * This type is used to identify different sections of the application where dynamic
 * columns can be registered. Each value corresponds to a specific page or
 * section in the application. This allows for flexible and dynamic routing based
 * on the context and requirements of the application.
 *
 * Possible values:
 * - 'job-employee': A sub-page under the jobs section.
 */
export type PageDataTableLocationRegistryId = 'job-employee';

/**
 * Page route configuration with additional table columns options.
 */
export interface PageDataTableRegistryConfig extends Omit<IColumn, 'title'> {
	/**
	 * @description
	 * The location identifier for the page route.
	 */
	datatableId: PageDataTableLocationRegistryId;

	/**
	 * @description
	 * The column identifier for the column. This is used to identify the column in the table for specific page location.
	 */
	columnId: string;

	/**
	 * @description
	 * The translatable key for the tab title.
	 */
	title?: string | (() => string);

	/**
	 * @description
	 * The order of the column in the table.
	 * If not provided, the column will be added to the end of the table.
	 */
	order?: number;

	/**
	 * @description
	 * The column configuration for the column. This is used to override the default column configuration.
	 */
	column?: IColumn;
}

/**
 * Registry for page data table columns.
 */
export interface IPageDataTableRegistry {
	/**
	 * Register a column configuration.
	 *
	 * This method adds a single column configuration to the registry. If the column ID
	 * already exists, an error will be thrown, but the column will still be registered.
	 *
	 * @param config
	 */
	registerPageDataTableColumn(config: PageDataTableRegistryConfig): void;

	/**
	 * Register multiple column configurations.
	 *
	 * This method adds multiple column configurations to the registry. If any column
	 * within the provided configurations already exists, an error will be thrown for that
	 * specific column, but other columns will still be registered.
	 *
	 * @param configs An array of configuration objects for the columns to be registered.
	 */
	registerPageDataTableColumns(configs: PageDataTableRegistryConfig[]): void;
}
