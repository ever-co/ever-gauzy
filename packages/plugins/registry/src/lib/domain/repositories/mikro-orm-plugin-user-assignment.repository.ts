import { MikroOrmBaseEntityRepository } from '@gauzy/core';
import { PluginUserAssignment } from '../entities/plugin-user-assignment.entity';

export class MikroOrmPluginUserAssignmentRepository extends MikroOrmBaseEntityRepository<PluginUserAssignment> {}
