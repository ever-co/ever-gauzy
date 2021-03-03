import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { RouterModule } from 'nest-router';
import { TenantModule } from '@gauzy/core';
import { Changelog } from './changelog.entity';
import { ChangelogController } from './changelog.controller';
import { ChangelogService } from './changelog.service';

@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: '/changelog', module: ChangelogModule }
		]),
		TypeOrmModule.forFeature([Changelog]),
		CqrsModule,
		TenantModule
	],
	controllers: [ChangelogController],
	providers: [ChangelogService],
	exports: [ChangelogService]
})
export class ChangelogModule {}
