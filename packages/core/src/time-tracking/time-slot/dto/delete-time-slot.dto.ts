import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty } from "class-validator";

export class DeleteTimeSlotDTO {

	@ApiProperty({ type: () => Array })
	@IsNotEmpty({
		message: "TimeSlot ids should not be empty"
	})
	readonly ids: string[];
}