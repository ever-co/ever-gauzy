import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { EmailSendModule } from './../email-send/email-send.module';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { Payment } from './payment.entity';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { PaymentMapService } from './payment.map.service';
import { TypeOrmPaymentRepository } from './repository/type-orm-payment.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([Payment]),
		MikroOrmModule.forFeature([Payment]),
		RolePermissionModule,
		EmailSendModule
	],
	controllers: [PaymentController],
	providers: [PaymentService, PaymentMapService, TypeOrmPaymentRepository],
	exports: [PaymentService, PaymentMapService, TypeOrmPaymentRepository]
})
export class PaymentModule {}
