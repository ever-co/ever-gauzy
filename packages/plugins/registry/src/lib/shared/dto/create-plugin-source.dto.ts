import { PluginOSArch, PluginOSType, PluginSourceType } from '@gauzy/contracts';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsNotEmptyObject } from 'class-validator';
import { PluginSourceDTO } from './plugin-source.dto';

export class CreatePluginSourceDTO {
	@ApiProperty({
		type: [PluginSourceDTO],
		description: 'Array of plugin sources',
		examples: [
			{
				name: 'source1',
				operatingSystem: PluginOSType.UNIVERSAL,
				architecture: PluginOSArch.X64,
				url: 'https://example.com/plugin1',
				type: PluginSourceType.CDN
			},
			{
				name: '@scope/plugin2',
				operatingSystem: PluginOSType.MAC,
				architecture: PluginOSArch.ARM,
				scope: '@scope',
				registry: 'https://registry.npmjs.org/',
				private: true,
				type: PluginSourceType.NPM
			}
		]
	})
	@IsArray({
		message: 'Sources must be provided as an array'
	})
	@IsNotEmptyObject(
		{ nullable: false },
		{
			message: 'Each source object must not be empty',
			each: true
		}
	)
	@Type(() => PluginSourceDTO)
	sources: PluginSourceDTO[];
}
