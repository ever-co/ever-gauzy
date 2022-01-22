import { IEmployee, IEmployeeCreateInput, IOrganization, ISkill, ITag, ITenant, IUser } from "@gauzy/contracts";
import { IsNotEmpty, IsNotEmptyObject, IsObject } from "class-validator";

export class EmployeeInputDto implements IEmployeeCreateInput {

    @IsObject()
    @IsNotEmptyObject()
    user: IUser;

    @IsNotEmpty()
    password: string;
    
    offerDate?: Date;
    acceptDate?: Date;
    rejectDate?: Date;
    members?: IEmployee[];
    tags?: ITag[];
    skills?: ISkill[];
    startedWorkOn?: any;
    short_description?: string;
    description?: string;
    originalUrl?: string;
    isActive?: boolean;
    organizationId?: string;
    organization?: IOrganization;
    tenantId?: string;
    tenant?: ITenant;
    id?: string;
    createdAt?: Date;
    updatedAt?: Date;

}