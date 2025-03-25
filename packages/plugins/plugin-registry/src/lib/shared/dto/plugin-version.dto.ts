import { OmitType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { PluginVersion } from '../../domain/entities/plugin-version.entity';
import { PluginSourceDTO } from './plugin-source.dto';

export class PluginVersionDTO extends OmitType(PluginVersion, [
	'id',
	'createdAt',
	'updatedAt',
	'deletedAt',
	'source',
	'downloadCount'
] as const) {
	@ValidateNested()
	@Type(() => PluginSourceDTO)
	source: PluginSourceDTO;
}
