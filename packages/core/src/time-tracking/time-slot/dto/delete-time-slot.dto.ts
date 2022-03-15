import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty } from "class-validator";
import { TenantOrganizationBaseDTO } from "./../../../core/dto";

export class DeleteTimeSlotDTO extends TenantOrganizationBaseDTO {

	@ApiProperty({ type: () => Array })
	@IsNotEmpty({
		message: "TimeSlot ids should not be empty"
	})
	readonly ids: string[];
}