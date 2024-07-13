import { IHelpCenterArticleUpdate } from '@gauzy/contracts';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateHelpCenterArticleDTO implements IHelpCenterArticleUpdate {
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	name: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	description: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	data: string;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	draft: boolean;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	privacy: boolean;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	categoryId: string;
}
