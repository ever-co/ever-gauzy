import { IRole, IUser } from "@gauzy/contracts";
import { IsEmail, IsNotEmpty, IsNotEmptyObject, IsObject } from "class-validator";

export class UserInputDto implements IUser{

    @IsEmail()
    @IsNotEmpty()
    email: string;

    @IsObject()
    @IsNotEmptyObject()
    role: IRole;
    
}