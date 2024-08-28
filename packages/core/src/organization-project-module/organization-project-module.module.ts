import { Module } from '@nestjs/common';
import { OrganizationProjectModuleService } from './organization-project-module.service';
import { OrganizationProjectModuleController } from './organization-project-module.controller';

@Module({
	providers: [OrganizationProjectModuleService],
	controllers: [OrganizationProjectModuleController]
})
export class OrganizationProjectModuleModule {}
