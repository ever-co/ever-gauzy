import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from 'nest-router';
import { Payment } from './payment.entity';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { TenantModule } from '../tenant/tenant.module';
import { UserService } from '../user/user.service';
import { PaymentMapService } from './payment.map.service';
import { EmailModule } from './../email/email.module';
import { User } from '../user/user.entity';

@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: '/payments', module: PaymentModule }
		]),
		TypeOrmModule.forFeature([
			User,
			Payment
		]),
		TenantModule,
		EmailModule
	],
	controllers: [PaymentController],
	providers: [PaymentService, UserService, PaymentMapService],
	exports: [PaymentService, UserService, PaymentMapService]
})
export class PaymentModule {}
