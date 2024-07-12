import { IOrganizationProjectSetting } from '@gauzy/contracts';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { TenantOrganizationBaseDTO } from '../../core/dto';

export class UpdateProjectSettingDTO extends TenantOrganizationBaseDTO implements IOrganizationProjectSetting {
	/*
	|--------------------------------------------------------------------------
	| Embeddable Columns
	|--------------------------------------------------------------------------
	*/
	@ApiPropertyOptional({ type: 'object' })
	@IsOptional()
	readonly customFields?: Record<string, any>;

	// Auto-sync tasks property
	@ApiPropertyOptional({ type: Boolean })
	@IsOptional()
	@IsBoolean()
	readonly isTasksAutoSync: boolean;

	// Auto-sync on label property
	@ApiPropertyOptional({ type: Boolean })
	@IsOptional()
	@IsBoolean()
	readonly isTasksAutoSyncOnLabel: boolean;

	// Auto-sync tasks label property
	@ApiPropertyOptional({ type: String })
	@IsOptional()
	@IsString()
	readonly syncTag: string;
}
