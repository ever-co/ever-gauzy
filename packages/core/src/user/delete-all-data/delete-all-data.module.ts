// Modified code from https://github.com/xmlking/ngx-starter-kit.
// MIT License, see https://github.com/xmlking/ngx-starter-kit/blob/develop/LICENSE
// Copyright (c) 2018 Sumanth Chinthagunta

import { forwardRef, Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from 'nest-router';
import { Employee, Organization, Tag, User, UserOrganization } from 'core/entities/internal';
import { DeleteAllDataService } from './delete-all-data.service';
import { SharedModule } from 'shared/shared.module';
import { coreEntities } from 'core';
import { getEntitiesFromPlugins } from '@gauzy/plugin';
import { getConfig } from '@gauzy/config';

@Module({
	imports: [
		RouterModule.forRoutes([{ path: '/user', module: DeleteAllDataModule }]),
		TypeOrmModule.forFeature([
			...coreEntities,
			...getEntitiesFromPlugins(getConfig().plugins)
		]),
		SharedModule,
		CqrsModule,
	],
	providers: [
		DeleteAllDataService,
	],
	exports: [TypeOrmModule, DeleteAllDataService]
})
export class DeleteAllDataModule { }
