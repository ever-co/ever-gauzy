import { PluginSource } from '../../domain/entities/plugin-source.entity';
import { OmitType } from '@nestjs/swagger';

export class PluginSourceDTO extends OmitType(PluginSource, [
	'id',
	'createdAt',
	'updatedAt',
	'deletedAt',
	'fullName'
] as const) {}
