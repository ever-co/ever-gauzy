// Modified code from https://github.com/alexitaylor/angular-graphql-nestjs-postgres-starter-kit.
// MIT License, see https://github.com/alexitaylor/angular-graphql-nestjs-postgres-starter-kit/blob/master/LICENSE
// Copyright (c) 2019 Alexi Taylor
import yargs from 'yargs';
import * as chalk from 'chalk';

import { NestFactory } from '@nestjs/core';
import { IPluginConfig } from '@gauzy/common';
import { registerPluginConfig } from './../../bootstrap';
import { SeedDataService } from './seed-data.service';
import { SeederModule } from './seeder.module';

/**
 * Usage:
 * yarn db:seed All
 * yarn db:seed Default
 * yarn db:seed Jobs
 * yarn db:seed Reports
 * yarn db:seed Ever
 *
 */
export async function seedModule(devConfig: Partial<IPluginConfig>) {
	await registerPluginConfig(devConfig);

	NestFactory.createApplicationContext(SeederModule.forPluings(), {
		logger: false
	})
		.then((app) => {
			const seeder = app.get(SeedDataService);
			const argv: any = yargs(process.argv).argv;
			const module = argv.name;
			const methodName = `run${module}Seed`;

			if (seeder[methodName]) {
				seeder[methodName]()
					.catch((error) => {
						throw error;
					})
					.finally(() => app.close());
			} else {
				console.log(
					chalk.red(
						`Method ${methodName} not found in SeedDataService`
					)
				);
				app.close();
			}
		})
		.catch((error) => {
			throw error;
		});
}
