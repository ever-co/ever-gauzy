/* Load environment variables before executing any command */
import { loadEnv } from '@gauzy/config/src/lib/load-env';
loadEnv();

import * as yargs from 'yargs';
import { createMigration, generateMigration, revertLastDatabaseMigration, runDatabaseMigrations } from '@gauzy/core';
import { pluginConfig } from './plugin-config';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions
yargs
	.command({
		command: 'migration:run',
		describe: 'Runs all pending migrations command.',
		// function for your command
		handler() {
			runDatabaseMigrations(pluginConfig);
		}
	})
	.command({
		command: 'migration:revert',
		describe: 'Reverts last migration command.',
		// function for your command
		handler() {
			revertLastDatabaseMigration(pluginConfig);
		}
	})
	.command({
		command: 'migration:generate',
		describe: 'Generates a new migration file with sql needs to be executed to update schema.',
		builder: {
			n: {
				alias: 'name',
				describe: 'Name of the migration class.',
				type: 'string',
				require: true
			},
			d: {
				alias: 'dir',
				describe: 'Directory where migration should be created.'
			}
		},
		// function for your command
		handler(argv) {
			const name = argv['name'] as string;
			generateMigration(pluginConfig, { name });
		}
	})
	.command({
		command: 'migration:create',
		describe: 'Create a new blank migration file to be executed to create/update schema.',
		builder: {
			n: {
				alias: 'name',
				describe: 'Name of the migration class.',
				type: 'string',
				require: true
			},
			d: {
				alias: 'dir',
				describe: 'Directory where migration should be created.'
			}
		},
		// function for your command
		handler(argv) {
			const name = argv['name'] as string;
			createMigration(pluginConfig, { name });
		}
	}).argv; // To set above changes
