import { forwardRef, Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from 'nest-router';
import { UserModule } from './../user/user.module';
import { TenantModule } from './../tenant/tenant.module';
import { EmployeeProposalTemplateController } from './employee-proposal-template.controller';
import { EmployeeProposalTemplate } from './employee-proposal-template.entity';
import { EmployeeProposalTemplateService } from './employee-proposal-template.service';

@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: '/employee-proposal-template', module: EmployeeProposalTemplateModule }
		]),
		TypeOrmModule.forFeature([ EmployeeProposalTemplate ]),
		forwardRef(() => TenantModule),
		forwardRef(() => UserModule),
		CqrsModule
	],
	controllers: [EmployeeProposalTemplateController],
	providers: [EmployeeProposalTemplateService],
	exports: [TypeOrmModule, EmployeeProposalTemplateService]
})
export class EmployeeProposalTemplateModule {}
