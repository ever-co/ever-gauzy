import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from 'nest-router';
import { Payment } from './payment.entity';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { TenantModule } from '../tenant/tenant.module';
import { UserModule } from './../user/user.module';
import { PaymentMapService } from './payment.map.service';
import { EmailModule } from './../email/email.module';

@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: '/payments', module: PaymentModule }
		]),
		TypeOrmModule.forFeature([
			Payment
		]),
		TenantModule,
		UserModule,
		EmailModule
	],
	controllers: [PaymentController],
	providers: [PaymentService, PaymentMapService],
	exports: [
		TypeOrmModule,
		PaymentService,
		PaymentMapService
	]
})
export class PaymentModule {}
