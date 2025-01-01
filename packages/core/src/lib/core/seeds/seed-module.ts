// Modified code from https://github.com/alexitaylor/angular-graphql-nestjs-postgres-starter-kit.
// MIT License, see https://github.com/alexitaylor/angular-graphql-nestjs-postgres-starter-kit/blob/master/LICENSE
// Copyright (c) 2019 Alexi Taylor

import * as yargs from 'yargs';
import * as chalk from 'chalk';

import { NestFactory } from '@nestjs/core';
import { ApplicationPluginConfig } from '@gauzy/common';
import { registerPluginConfig } from './../../bootstrap';
import { SeedDataService } from './seed-data.service';
import { SeederModule } from './seeder.module';

/**
* Usage:
* yarn seed:module All
* yarn seed:module Default
* yarn seed:module Jobs
* yarn seed:module Reports
* yarn seed:module Ever
*
*/
export async function seedModule(devConfig: Partial<ApplicationPluginConfig>) {
	await registerPluginConfig(devConfig);

	NestFactory.createApplicationContext(SeederModule.forPlugins(), {
		logger: ['log', 'error', 'warn', 'debug', 'verbose']
	}).then((app) => {
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
	}).catch((error) => {
		throw error;
	});
}
