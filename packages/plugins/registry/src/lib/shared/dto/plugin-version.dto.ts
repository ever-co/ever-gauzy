import { OmitType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsNotEmptyObject, ValidateNested } from 'class-validator';
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
	@ArrayMinSize(1, {
		message: 'At least one source must be provided'
	})
	@ArrayMaxSize(4, {
		message: 'At most four sources can be provided'
	})
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
