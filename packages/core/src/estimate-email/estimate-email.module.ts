import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from '@nestjs/core';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { User } from '../user/user.entity';
import { UserService } from '../user/user.service';
import { EstimateEmailController } from './estimate-email.controller';
import { EstimateEmailService } from './estimate-email.service';
import { Organization } from '../organization/organization.entity';
import { Invoice } from '../invoice/invoice.entity';
import { EstimateEmail } from './estimate-email.entity';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { TaskModule } from '../tasks/task.module';

@Module({
	imports: [
		RouterModule.register([{ path: '/estimate-email', module: EstimateEmailModule }]),
		TypeOrmModule.forFeature([User, EstimateEmail, Invoice, Organization]),
		MikroOrmModule.forFeature([User, EstimateEmail, Invoice, Organization]),
		RolePermissionModule,
		TaskModule
	],
	controllers: [EstimateEmailController],
	providers: [EstimateEmailService, UserService],
	exports: [EstimateEmailService, UserService]
})
export class EstimateEmailModule { }
