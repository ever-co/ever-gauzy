import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Changelog } from './changelog.entity';
import { CqrsModule } from '@nestjs/cqrs';
import { TenantModule } from '../tenant/tenant.module';
import { ChangelogController } from './changelog.controller';
import { ChangelogService } from './changelog.service';

@Module({
	imports: [TypeOrmModule.forFeature([Changelog]), CqrsModule, TenantModule],
	controllers: [ChangelogController],
	providers: [ChangelogService],
	exports: [ChangelogService]
})
export class ChangelogModule {}
