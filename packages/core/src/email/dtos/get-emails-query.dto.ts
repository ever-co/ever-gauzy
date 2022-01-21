import { IEmailFindInput } from "@gauzy/contracts";
import { IsArray, IsNotEmpty, IsNumber, IsObject } from "class-validator";

export class GetEmailsQueryDto {

    @IsNotEmpty()
    @IsArray()
    relations: string[];

    @IsNotEmpty()
    @IsObject()
	findInput: IEmailFindInput;

    @IsNumber()
    @IsNotEmpty()
	take: number

}