import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from '@nestjs/core';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { EstimateEmailController } from './estimate-email.controller';
import { EstimateEmailService } from './estimate-email.service';
import { Organization } from '../organization/organization.entity';
import { Invoice } from '../invoice/invoice.entity';
import { EstimateEmail } from './estimate-email.entity';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { TaskModule } from '../tasks/task.module';
import { UserModule } from '../user/user.module';

@Module({
	imports: [
		RouterModule.register([{ path: '/estimate-email', module: EstimateEmailModule }]),
		TypeOrmModule.forFeature([EstimateEmail, Invoice, Organization]),
		MikroOrmModule.forFeature([EstimateEmail, Invoice, Organization]),
		RolePermissionModule,
		UserModule,
		TaskModule
	],
	controllers: [EstimateEmailController],
	providers: [EstimateEmailService],
	exports: [EstimateEmailService]
})
export class EstimateEmailModule { }
