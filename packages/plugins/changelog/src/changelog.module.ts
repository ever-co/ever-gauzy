import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { RouterModule } from 'nest-router';
import { TenantModule } from '@gauzy/core';
import { Changelog } from './changelog.entity';
import { ChangelogController } from './changelog.controller';
import { ChangelogService } from './changelog.service';
import { CommandHandlers } from './commands/handlers';

@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: '/changelog', module: ChangelogModule }
		]),
		TypeOrmModule.forFeature([Changelog]),
		forwardRef(() => TenantModule),
		CqrsModule
	],
	controllers: [ChangelogController],
	providers: [
		ChangelogService, 
		...CommandHandlers
	],
	exports: [ChangelogService]
})
export class ChangelogModule {}
