import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { CqrsModule } from '@nestjs/cqrs';
import { Changelog } from './changelog.entity';
import { ChangelogController } from './changelog.controller';
import { ChangelogService } from './changelog.service';
import { CommandHandlers } from './commands/handlers';
import { TypeOrmChangelogRepository } from './repository/type-orm-changelog.repository';

@Module({
	controllers: [ChangelogController],
	imports: [TypeOrmModule.forFeature([Changelog]), MikroOrmModule.forFeature([Changelog]), CqrsModule],
	providers: [ChangelogService, TypeOrmChangelogRepository, ...CommandHandlers]
})
export class ChangelogModule {}
