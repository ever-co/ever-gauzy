import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsUrl } from 'class-validator';
import { IJitsuConfig } from '@gauzy/contracts';
import { IsSecret } from '../../core/decorators';
import { Trimmed } from '../../shared/decorators/trim.decorator';

export class JitsuConfigDTO implements IJitsuConfig {
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@IsUrl()
	@Trimmed()
	readonly jitsu_server_url?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@IsSecret()
	@Trimmed()
	readonly jitsu_server_write_key?: string;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	readonly jitsu_server_debug?: boolean;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	readonly jitsu_server_echo_events?: boolean;
}
