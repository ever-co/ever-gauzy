// Modified code from https://github.com/alexitaylor/angular-graphql-nestjs-postgres-starter-kit.
// MIT License, see https://github.com/alexitaylor/angular-graphql-nestjs-postgres-starter-kit/blob/master/LICENSE
// Copyright (c) 2019 Alexi Taylor

import { NestFactory } from '@nestjs/core';
import { IPluginConfig } from '@gauzy/common';
import { registerPluginConfig } from './../../bootstrap';
import { SeedDataService } from './seed-data.service';
import { SeederModule } from './seeder.module';

/**
* WARNING: Running this file will generate and insert new, random jobs related data into your database.
* 
*/
export async function seedJob(devConfig: Partial<IPluginConfig>) {
	await registerPluginConfig(devConfig);

	NestFactory.createApplicationContext(SeederModule.forPluings(), {
		logger: false
	})
		.then((app) => {
			const seeder = app.get(SeedDataService);
			seeder
				.runJobsSeed()
				.then(() => {})
				.catch((error) => {
					throw error;
				})
				.finally(() => app.close());
		})
		.catch((error) => {
			throw error;
		});
}
