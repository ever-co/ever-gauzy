import { Type } from "class-transformer";
import { IsArray, ValidateNested } from "class-validator";
import { CreateKeyresultDTO } from "./create-keyresult.dto";

export class KeyresultBultInputDTO {

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateKeyresultDTO)
    list : CreateKeyresultDTO[]

}