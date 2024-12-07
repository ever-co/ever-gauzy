// Modified code from https://github.com/alexitaylor/angular-graphql-nestjs-postgres-starter-kit.
// MIT License, see https://github.com/alexitaylor/angular-graphql-nestjs-postgres-starter-kit/blob/master/LICENSE
// Copyright (c) 2019 Alexi Taylor

import { NestFactory } from '@nestjs/core';
import { ApplicationPluginConfig } from '@gauzy/common';
import { registerPluginConfig } from './../../bootstrap';
import { SeedDataService } from './seed-data.service';
import { SeederModule } from './seeder.module';

/**
* WARNING: Running this file will DELETE all data in your database
* and generate and insert new, random data into your database.
*
* BE CAREFUL running this file in production env. It's possible to delete all production data.
* SeedData checks if environment is in production or not by checking src/environments/environment.ts file configs.
* If environment.production config is set to true, then the seeding process will only generate default roles and 2 default users.
* */
export async function seedAll(devConfig: Partial<ApplicationPluginConfig>) {
	await registerPluginConfig(devConfig);

	NestFactory.createApplicationContext(SeederModule.forPlugins(), {
		logger: ['log', 'error', 'warn', 'debug', 'verbose']
	}).then((app) => {
		const seeder = app.get(SeedDataService);
		seeder
			.runAllSeed()
			.then(() => { })
			.catch((error) => {
				throw error;
			})
			.finally(() => app.close());
	}).catch((error) => {
		throw error;
	});
}
