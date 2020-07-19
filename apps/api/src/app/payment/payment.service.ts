import { CrudService } from '../core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { Payment } from './payment.entity';

@Injectable()
export class PaymentService extends CrudService<Payment> {
	constructor(
		@InjectRepository(Payment)
		private readonly paymentRepository: Repository<Payment>
	) {
		super(paymentRepository);
	}
}
