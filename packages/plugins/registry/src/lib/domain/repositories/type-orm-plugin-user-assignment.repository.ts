import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PluginUserAssignment } from '../entities/plugin-user-assignment.entity';

export class TypeOrmPluginUserAssignmentRepository extends Repository<PluginUserAssignment> {
	constructor(@InjectRepository(PluginUserAssignment) readonly repository: Repository<PluginUserAssignment>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
