import { IDeleteTimeLog } from "@gauzy/contracts";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ArrayNotEmpty, IsBoolean, IsOptional } from "class-validator";
import { TenantOrganizationBaseDTO } from "./../../../core/dto";

export class DeleteTimeLogDTO extends TenantOrganizationBaseDTO implements IDeleteTimeLog {

	@ApiProperty({ type: () => Array })
	@ArrayNotEmpty()
	logIds: string[] = [];

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	forceDelete: boolean = true;
}
