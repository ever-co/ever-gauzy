import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from 'nest-router';
import { Payment } from './payment.entity';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { UserService } from '../user/user.service';
import { User } from '../user/user.entity';
import { TenantModule } from '../tenant/tenant.module';
import { PaymentMapService } from './payment.map.service';

@Module({
	imports: [
		RouterModule.forRoutes([{ path: '/payments', module: PaymentModule }]),
		TypeOrmModule.forFeature([User, Payment]),
		TenantModule
	],
	controllers: [PaymentController],
	providers: [PaymentService, UserService, PaymentMapService],
	exports: [PaymentService, UserService, PaymentMapService]
})
export class PaymentModule {}
