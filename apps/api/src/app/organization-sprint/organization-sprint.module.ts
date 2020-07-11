import { OrganizationSprintService } from './organization-sprint.service';
import { OrganizationSprintController } from './organization-sprint.controller';
import { OrganizationSprint } from './organization-sprint.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';

@Module({
	imports: [TypeOrmModule.forFeature([OrganizationSprint])],
	controllers: [OrganizationSprintController],
	providers: [OrganizationSprintService],
	exports: [OrganizationSprintService]
})
export class OrganizationSprintModule {}
