import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from '@nestjs/core';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Payment } from './payment.entity';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { TenantModule } from '../tenant/tenant.module';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { UserModule } from './../user/user.module';
import { PaymentMapService } from './payment.map.service';
import { EmailSendModule } from './../email-send/email-send.module';

@Module({
	imports: [
		RouterModule.register([{ path: '/payments', module: PaymentModule }]),
		TypeOrmModule.forFeature([Payment]),
		MikroOrmModule.forFeature([Payment]),
		TenantModule,
		RolePermissionModule,
		UserModule,
		EmailSendModule
	],
	controllers: [PaymentController],
	providers: [PaymentService, PaymentMapService],
	exports: [TypeOrmModule, MikroOrmModule, PaymentService, PaymentMapService]
})
export class PaymentModule { }
