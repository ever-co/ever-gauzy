import * as yargs from "yargs";
import { revertLastDatabaseMigration, runDatabaseMigrations } from '@gauzy/core';
import { pluginConfig } from "./plugin-config";

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
    .parse(); // To set above changes