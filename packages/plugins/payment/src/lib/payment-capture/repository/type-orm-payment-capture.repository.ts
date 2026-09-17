import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentCapture } from '../payment-capture.entity';

/**
 * TypeORM repository of PaymentCapture. It exists so that providers depend on a repository of this
 * package rather than on a bare \`Repository<PaymentCapture>\`, which is what lets the service inject a
 * single class under both ORMs.
 */
@Injectable()
export class TypeOrmPaymentCaptureRepository extends Repository<PaymentCapture> {
	constructor(@InjectRepository(PaymentCapture) readonly repository: Repository<PaymentCapture>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
