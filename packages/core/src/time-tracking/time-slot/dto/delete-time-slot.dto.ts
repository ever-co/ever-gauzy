import { ApiProperty } from "@nestjs/swagger";
import { ArrayNotEmpty } from "class-validator";
import { IDeleteTimeSlot } from "@gauzy/contracts";
import { TenantOrganizationBaseDTO } from "./../../../core/dto";

export class DeleteTimeSlotDTO extends TenantOrganizationBaseDTO
	implements IDeleteTimeSlot {

	@ApiProperty({ type: () => Array })
	@ArrayNotEmpty()
	readonly ids: string[] = [];
}