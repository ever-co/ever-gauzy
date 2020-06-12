import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment } from './payment.entity';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { UserService } from '../user/user.service';
import { User } from '../user/user.entity';

@Module({
	imports: [TypeOrmModule.forFeature([User, Payment])],
	controllers: [PaymentController],
	providers: [PaymentService, UserService],
	exports: [PaymentService, UserService]
})
export class PaymentModule {}
