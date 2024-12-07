import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from '@nestjs/core';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Payment } from './payment.entity';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { PaymentMapService } from './payment.map.service';
import { EmailSendModule } from './../email-send/email-send.module';
import { TypeOrmPaymentRepository } from './repository/type-orm-payment.repository';

@Module({
	imports: [
		RouterModule.register([{ path: '/payments', module: PaymentModule }]),
		TypeOrmModule.forFeature([Payment]),
		MikroOrmModule.forFeature([Payment]),
		RolePermissionModule,
		EmailSendModule
	],
	controllers: [PaymentController],
	providers: [PaymentService, PaymentMapService, TypeOrmPaymentRepository],
	exports: [TypeOrmModule, MikroOrmModule, PaymentService, PaymentMapService, TypeOrmPaymentRepository]
})
export class PaymentModule {}
