import * as yargs from "yargs";
import { runDatabaseMigrations } from '@gauzy/core';
import { pluginConfig } from "./plugin-config";

yargs
    .command({
        command: 'migration:run',
        describe: 'Runs all pending migrations.',
        // function for your command
        handler() {
            runDatabaseMigrations(pluginConfig);
        }
    })
    .parse(); // To set above changes