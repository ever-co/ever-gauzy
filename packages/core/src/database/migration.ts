import * as yargs from "yargs";
import { devConfig } from "../dev-config";
import { createMigration, generateMigration, revertLastDatabaseMigration, runDatabaseMigrations } from "./migration-executor";

yargs
    .command({
        command: 'migration:run',
        describe: 'Runs all pending migrations command.',
        // function for your command
        handler() {
            runDatabaseMigrations(devConfig);
        }
    })
    .command({
        command: 'migration:revert',
        describe: 'Reverts last migration command.',
        // function for your command
        handler() {
            revertLastDatabaseMigration(devConfig);
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
            generateMigration(devConfig, { name });
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
            createMigration(devConfig, { name });
        }
    })
    .argv; // To set above changes
