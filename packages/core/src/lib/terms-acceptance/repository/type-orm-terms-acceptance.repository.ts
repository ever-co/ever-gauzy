import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TermsAcceptance } from '../terms-acceptance.entity';

@Injectable()
export class TypeOrmTermsAcceptanceRepository extends Repository<TermsAcceptance> {
	constructor(@InjectRepository(TermsAcceptance) readonly repository: Repository<TermsAcceptance>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
