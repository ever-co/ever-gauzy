import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsNotEmpty, IsOptional } from "class-validator";
import { TenantOrganizationBaseDTO } from "./../../../core/dto";

export class DeleteTimeLogDTO extends TenantOrganizationBaseDTO {

	@ApiProperty({ type: () => Array })
	@IsNotEmpty({
		message: "LogIds should not be empty"
	})
    readonly logIds: string[];

	@ApiProperty({ type: () => Boolean, readOnly: true })
	@IsOptional()
	@IsBoolean()
	readonly forceDelete: boolean = true;
}