import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsDate, IsOptional } from "class-validator";
import { RatesDTO } from "./rates.dto";

export abstract class HiringDTO extends RatesDTO {

    @ApiPropertyOptional({ type: () => Date })
    @IsOptional()
    @IsDate({
        message: "Offer date on must be a Date instance"
    })
    readonly offerDate?: Date;

    @ApiPropertyOptional({ type: () => Date })
    @IsOptional()
    @IsDate({
        message: "Accept date on must be a Date instance"
    })
    readonly acceptDate?: Date;

    @ApiPropertyOptional({ type: () => Date })
    @IsOptional()
    @IsDate({
        message: "Reject date on must be a Date instance"
    })
    readonly rejectDate?: Date;
}