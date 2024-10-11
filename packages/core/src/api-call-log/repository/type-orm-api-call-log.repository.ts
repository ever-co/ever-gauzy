import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ApiCallLog } from '../api-call-log.entity';

@Injectable()
export class TypeOrmApiCallLogRepository extends Repository<ApiCallLog> {
	// constructor(@InjectRepository(ApiCallLog) readonly repository: Repository<ApiCallLog>) {
	// 	super(repository.target, repository.manager, repository.queryRunner);
	// }
}
