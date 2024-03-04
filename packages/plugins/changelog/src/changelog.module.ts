import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { CqrsModule } from '@nestjs/cqrs';
import { RouterModule } from '@nestjs/core';
import { Changelog } from './changelog.entity';
import { ChangelogController } from './changelog.controller';
import { ChangelogService } from './changelog.service';
import { CommandHandlers } from './commands/handlers';

@Module({
	imports: [
		RouterModule.register([{ path: '/changelog', module: ChangelogModule }]),
		TypeOrmModule.forFeature([Changelog]),
		MikroOrmModule.forFeature([Changelog]),
		CqrsModule
	],
	controllers: [ChangelogController],
	providers: [ChangelogService, ...CommandHandlers],
	exports: [ChangelogService]
})
export class ChangelogModule { }
