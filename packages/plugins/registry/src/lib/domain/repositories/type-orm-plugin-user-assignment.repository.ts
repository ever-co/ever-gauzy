import { Repository } from 'typeorm';
import { PluginUserAssignment } from '../entities/plugin-user-assignment.entity';

export class TypeOrmPluginUserAssignmentRepository extends Repository<PluginUserAssignment> {}
