import { OmitType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { Plugin } from '../../domain/entities/plugin.entity';
import { PluginVersionDTO } from './plugin-version.dto';

export class CreatePluginDTO extends OmitType(Plugin, [
	'id',
	'createdAt',
	'updatedAt',
	'deletedAt',
	'versions',
	'version',
	'source',
	'downloadCount',
	'installed'
] as const) {
	@ValidateNested()
	@Type(() => PluginVersionDTO)
	version: PluginVersionDTO;
}
