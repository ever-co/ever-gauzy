import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty } from "class-validator";
import { IDeleteTimeSlot } from "@gauzy/contracts";
import { TenantOrganizationBaseDTO } from "./../../../core/dto";

export class DeleteTimeSlotDTO extends TenantOrganizationBaseDTO implements IDeleteTimeSlot {

	@ApiProperty({ type: () => Array })
	@IsNotEmpty({
		message: "TimeSlot ids should not be empty"
	})
	readonly ids: string[];
}