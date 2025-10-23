import { ID, IUser } from '@gauzy/contracts';
import {
	ColumnIndex,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	TenantOrganizationBaseEntity,
	User
} from '@gauzy/core';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { JoinColumn, RelationId } from 'typeorm';
import { IPluginInstallation } from '../../shared/models/plugin-installation.model';
import { IPluginUserAssignment } from '../../shared/models/plugin-user-assignment.model';
import { MikroOrmPluginUserAssignmentRepository } from '../repositories/mikro-orm-plugin-user-assignment.repository';
import { PluginInstallation } from './plugin-installation.entity';

@MultiORMEntity('plugin_user_assignment', { mikroOrmRepository: () => MikroOrmPluginUserAssignmentRepository })
export class PluginUserAssignment extends TenantOrganizationBaseEntity implements IPluginUserAssignment {
	@ApiProperty({ type: () => PluginInstallation, description: 'Plugin installation this assignment is for' })
	@MultiORMManyToOne(() => PluginInstallation, { onDelete: 'CASCADE' })
	@JoinColumn()
	pluginInstallation: IPluginInstallation;

	@RelationId((assignment: PluginUserAssignment) => assignment.pluginInstallation)
	@ColumnIndex()
	@MultiORMColumn({ nullable: false, relationId: true })
	@IsUUID('4', { message: 'pluginInstallationId must be a valid UUID (version 4)' })
	@IsNotEmpty({ message: 'pluginInstallationId is required' })
	pluginInstallationId: ID;

	@ApiProperty({ type: () => User, description: 'User assigned to the plugin installation' })
	@MultiORMManyToOne(() => User, { onDelete: 'CASCADE' })
	@JoinColumn()
	user: IUser;

	@RelationId((assignment: PluginUserAssignment) => assignment.user)
	@ColumnIndex()
	@MultiORMColumn({ nullable: false, relationId: true })
	@IsUUID('4', { message: 'userId must be a valid UUID (version 4)' })
	@IsNotEmpty({ message: 'userId is required' })
	userId: ID;

	@ApiProperty({ type: () => User, description: 'User who assigned this access', required: false })
	@MultiORMManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
	@JoinColumn()
	assignedBy: IUser;

	@RelationId((assignment: PluginUserAssignment) => assignment.assignedBy)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	@IsOptional()
	@IsUUID('4', { message: 'assignedById must be a valid UUID (version 4)' })
	assignedById?: ID;

	@ApiPropertyOptional({ type: () => String, description: 'Date when the user was assigned to the plugin' })
	@IsOptional()
	@IsDateString({}, { message: 'assignedAt date must be a valid ISO 8601 date string' })
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	assignedAt?: Date;

	@ApiPropertyOptional({ type: () => String, description: 'Date when the user assignment was revoked' })
	@IsOptional()
	@IsDateString({}, { message: 'revokedAt date must be a valid ISO 8601 date string' })
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	revokedAt?: Date;

	@ApiPropertyOptional({ type: () => User, description: 'User who revoked this access', required: false })
	@MultiORMManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
	@JoinColumn()
	revokedBy?: IUser;

	@RelationId((assignment: PluginUserAssignment) => assignment.revokedBy)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	@IsOptional()
	@IsUUID('4', { message: 'revokedById must be a valid UUID (version 4)' })
	revokedById?: ID;

	@ApiPropertyOptional({ type: () => String, description: 'Reason for the assignment' })
	@IsOptional()
	@MultiORMColumn({ type: 'text', nullable: true })
	reason?: string;

	@ApiPropertyOptional({ type: () => String, description: 'Reason for revoking the assignment' })
	@IsOptional()
	@MultiORMColumn({ type: 'text', nullable: true })
	revocationReason?: string;
}
