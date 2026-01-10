import { IPlugin } from '@gauzy/contracts';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsObject, IsOptional } from 'class-validator';
import { FindOneOptions } from 'typeorm';

export class PluginQueryOptions implements FindOneOptions<IPlugin> {
	@ApiPropertyOptional({
		description: 'Conditions to find a specific plugin',
		type: () => Object
	})
	@IsOptional()
	@IsObject()
	readonly where?: Partial<IPlugin>;

	@ApiPropertyOptional({
		description: 'Relations to be loaded with the plugin',
		type: [String],
		example: ['organization', 'tenant']
	})
	@IsOptional()
	@IsArray()
	readonly relations?: string[];

	@ApiPropertyOptional({
		description: 'Fields to select from the plugin entity',
		type: [String],
		example: ['id', 'name', 'version', 'enabled']
	})
	@IsOptional()
	@IsArray()
	readonly select?: (keyof IPlugin)[];

	@ApiPropertyOptional({
		description: 'Order by fields',
		type: () => Object,
		example: { name: 'createdAt', version: 'DESC' }
	})
	@IsOptional()
	@IsObject()
	readonly order?: { [P in keyof IPlugin]?: 'ASC' | 'DESC' };

	@ApiPropertyOptional({
		description: 'Include soft deleted records',
		type: Boolean,
		default: false
	})
	@IsOptional()
	@IsBoolean()
	readonly withDeleted?: boolean;

	@ApiPropertyOptional({
		description: 'Load eager relations automatically',
		type: Boolean,
		default: false
	})
	@IsOptional()
	@IsBoolean()
	readonly loadEagerRelations?: boolean;
}
