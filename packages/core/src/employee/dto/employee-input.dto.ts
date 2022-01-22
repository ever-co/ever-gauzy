import { IEmployee, IEmployeeCreateInput, IOrganization, ISkill, ITag, ITenant, IUser } from "@gauzy/contracts";
import { Type } from "class-transformer";
import { IsNotEmpty, IsNotEmptyObject, IsObject, ValidateNested } from "class-validator";
import { UserInputDto } from "./user-input-dto";

export class EmployeeInputDto implements IEmployeeCreateInput {

    @IsObject()
    @IsNotEmptyObject()
    @ValidateNested()
    @Type(() => UserInputDto)
    user: UserInputDto;

    @IsNotEmpty()
    password: string;

    offerDate?: Date;
    acceptDate?: Date;
    rejectDate?: Date;
    members?: IEmployee[];
    tags?: ITag[];
    skills?: ISkill[];

    @IsNotEmpty()
    startedWorkOn?: any;
    
    short_description?: string;
    description?: string;
    originalUrl?: string;
    isActive?: boolean;
    organizationId?: string;

    @IsObject()
    @IsNotEmptyObject()
    organization?: IOrganization;

    tenantId?: string;
    tenant?: ITenant;
    id?: string;
    createdAt?: Date;
    updatedAt?: Date;

}