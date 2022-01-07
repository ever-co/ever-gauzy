import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty } from "class-validator";

export class DeleteTimeLogDTO {

	@ApiProperty({ type: () => Array })
	@IsNotEmpty({
		message: "LogIds should not be empty"
	})
    readonly logIds: string[];
}