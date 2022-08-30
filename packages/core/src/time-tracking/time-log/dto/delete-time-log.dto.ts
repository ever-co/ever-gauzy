import { IDeleteTimeLog } from "@gauzy/contracts";
import { ApiProperty } from "@nestjs/swagger";
import { ArrayNotEmpty, IsBoolean, IsOptional } from "class-validator";
import { TenantOrganizationBaseDTO } from "./../../../core/dto";

export class DeleteTimeLogDTO extends TenantOrganizationBaseDTO
	implements IDeleteTimeLog {

	@ApiProperty({ type: () => Array, readOnly: true })
	@ArrayNotEmpty()
    readonly logIds: string[] = [];

	@ApiProperty({ type: () => Boolean, readOnly: true })
	@IsOptional()
	@IsBoolean()
	readonly forceDelete: boolean = true;
}