import { Module } from '@nestjs/common';
import { DatabaseConnectionProviderModule } from './connection-provider.module';

/**
 * Import and provide database migration classes.
 *
 * @module
 */
 @Module({
	imports: [DatabaseConnectionProviderModule],
	providers: [],
	exports: []
})
export class DatabaseMigrationModule { }