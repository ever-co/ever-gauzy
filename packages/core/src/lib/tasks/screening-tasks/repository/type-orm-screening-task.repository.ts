import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ScreeningTask } from '../screening-task.entity';

export class TypeOrmScreeningTaskRepository extends Repository<ScreeningTask> {
	constructor(@InjectRepository(ScreeningTask) readonly repository: Repository<ScreeningTask>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
