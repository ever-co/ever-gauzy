import { IEmployee, IInvoiceItem, IOrganization, IOrganizationProject, IOrganizationSprint, IOrganizationTeam, ITag, ITaskCreateInput, ITenant, IUser } from "@gauzy/contracts";
import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsNotEmptyObject, IsObject } from "class-validator";

export class CreateTaskDto implements ITaskCreateInput {

    creatorId?: string;

    @ApiProperty({ type : () => String})
    @IsNotEmpty()
    title: string;

    description?: string;
    status?: string;
    dueDate?: Date;
    estimate?: number;

    @ApiProperty({ type : () => Object })
    @IsObject()
    @IsNotEmptyObject()
    project?: IOrganizationProject;
    
    projectId?: string;
    tags?: ITag[];
    members?: IEmployee[];
    invoiceItems?: IInvoiceItem[];
    teams?: IOrganizationTeam[];
    organizationSprint?: IOrganizationSprint;
    organizationSprintId?: string;
    creator?: IUser;
    organizationId?: string;
    organization?: IOrganization;
    tenantId?: string;
    tenant?: ITenant;
    id?: string;
    createdAt?: Date;
    updatedAt?: Date;
    
}