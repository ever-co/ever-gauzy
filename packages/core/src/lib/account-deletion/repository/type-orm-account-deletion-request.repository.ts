import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccountDeletionRequest } from '../account-deletion-request.entity';

@Injectable()
export class TypeOrmAccountDeletionRequestRepository extends Repository<AccountDeletionRequest> {
	constructor(@InjectRepository(AccountDeletionRequest) readonly repository: Repository<AccountDeletionRequest>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
