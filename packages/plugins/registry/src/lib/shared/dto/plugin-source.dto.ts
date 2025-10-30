import { OmitType } from '@nestjs/swagger';
import { PluginSource } from '../../domain/entities/plugin-source.entity';

export class PluginSourceDTO extends OmitType(PluginSource, [
	'id',
	'createdAt',
	'updatedAt',
	'deletedAt',
	'fullName'
] as const) {}
