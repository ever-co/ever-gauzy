import { DataSource, DataSourceOptions } from "typeorm";

/**
 * Initialized Typeorm DataSource
 *
 * @param options
 * @returns
 */
export async function initializedDataSource(options: DataSourceOptions) {
	const dataSource = new DataSource(options);
	try {
		if (!dataSource.isInitialized) {
			await dataSource.initialize();
		}
	} catch (error) {
		console.error(error?.message);
	}
	return dataSource;
}