// Modified code from https://github.com/alexitaylor/angular-graphql-nestjs-postgres-starter-kit.
// MIT License, see https://github.com/alexitaylor/angular-graphql-nestjs-postgres-starter-kit/blob/master/LICENSE
// Copyright (c) 2019 Alexi Taylor
import yargs from 'yargs';
import * as chalk from 'chalk';

import { NestFactory } from '@nestjs/core';
import { IPluginConfig } from '@gauzy/common';
import { setConfig } from '@gauzy/config';
import { SeedDataService } from './../core/seeds/seed-data.service';
import { SeederModule } from './../core/seeds/seeder.module';

/**
 * Usage:
 * yarn db:seed All
 * yarn db:seed Default
 * yarn db:seed Jobs
 * yarn db:seed Reports
 *
 */
export async function seedModule(devConfig: Partial<IPluginConfig>) {
	if (Object.keys(devConfig).length > 0) {
		setConfig(devConfig);
	}

	NestFactory.createApplicationContext(SeederModule)
		.then((appContext) => {
			const seeder = appContext.get(SeedDataService);
			const argv: any = yargs(process.argv).argv;
			const module = argv.name;
			const methodName = `run${module}Seed`;

			if (seeder[methodName]) {
				seeder[methodName]()
					.catch((error) => {
						throw error;
					})
					.finally(() => appContext.close());
			} else {
				console.log(
					chalk.red(
						`Method ${methodName} not found in SeedDataService`
					)
				);
				appContext.close();
			}
		})
		.catch((error) => {
			throw error;
		});
}
