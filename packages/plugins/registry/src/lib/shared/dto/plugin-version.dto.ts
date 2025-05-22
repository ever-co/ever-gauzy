import { OmitType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNotEmptyObject, ValidateNested } from 'class-validator';
import { PluginVersion } from '../../domain/entities/plugin-version.entity';
import { PluginSourceDTO } from './plugin-source.dto';

export class PluginVersionDTO extends OmitType(PluginVersion, [
	'id',
	'createdAt',
	'updatedAt',
	'deletedAt',
	'sources',
	'downloadCount'
] as const) {
	@ValidateNested({ each: true })
	@IsNotEmptyObject(
		{ nullable: true },
		{
			message: 'A plugin version can’t be created without at least one source.',
			each: true
		}
	)
	@Type(() => PluginSourceDTO)
	sources: PluginSourceDTO[];
}
