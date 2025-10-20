import { OmitType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNotEmptyObject, ValidateNested } from 'class-validator';
import { Plugin } from '../../domain/entities/plugin.entity';
import { PluginVersionDTO } from './plugin-version.dto';

export class CreatePluginDTO extends OmitType(Plugin, [
	'versions',
	'version',
	'source',
	'downloadCount',
	'installed',
	'lastDownloadedAt',
	'uploadedBy',
	'category'
] as const) {
	@ValidateNested()
	@IsNotEmptyObject(
		{ nullable: true },
		{
			message: 'Version is required',
			each: true
		}
	)
	@Type(() => PluginVersionDTO)
	version: PluginVersionDTO;
}
