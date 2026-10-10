import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentAccountHolder } from '../payment-account-holder.entity';

@Injectable()
export class TypeOrmPaymentAccountHolderRepository extends Repository<PaymentAccountHolder> {
	constructor(@InjectRepository(PaymentAccountHolder) readonly repository: Repository<PaymentAccountHolder>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
