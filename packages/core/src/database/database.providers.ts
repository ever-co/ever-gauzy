import { API_DB_CONNECTION } from '@gauzy/common';
import { ConfigService } from '@gauzy/config';
import { DataSource, DataSourceOptions } from 'typeorm';
import { initializedDataSource } from './database-helper';

/**
 * API database connection provider
 */
export const API_PROVIDER = {
    provide: DataSource,
    inject: [ConfigService],
    useFactory: async (configService: ConfigService) => {
        const { dbConnectionOptions } = configService.config;
        return initializedDataSource({
            name: API_DB_CONNECTION,
            ...dbConnectionOptions
        } as DataSourceOptions);
    }
}