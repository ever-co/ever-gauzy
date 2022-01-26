import { IEmployee, IInvoiceItem, IOrganization, IOrganizationSprint, IOrganizationTeam, ITag } from "@gauzy/contracts";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsArray, IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator";

export abstract class TaskDTO {

    @ApiProperty({ type : () => String})
    @IsNotEmpty()
    readonly title: string;

    @ApiPropertyOptional({ type: () => String })
    @IsOptional()
    @IsString()
    readonly description?: string;

    @ApiPropertyOptional({ type: () => String })
    @IsOptional()
    @IsString()
    readonly status?: string;

    @ApiPropertyOptional({ type: () => Date })
    @IsOptional()
    @IsString()
    readonly dueDate?: Date;

    @ApiPropertyOptional({ type: () => Number })
    @IsOptional()
    @IsNumber()
    readonly estimate?: number;

    @ApiPropertyOptional({ type: () => Array, isArray: true })
    @IsOptional()
    @IsArray()
    readonly tags?: ITag[];

    @ApiPropertyOptional({ type: () => Array, isArray: true })
    @IsOptional()
    @IsArray()
    readonly members?: IEmployee[];

    @ApiPropertyOptional({ type: () => Array, isArray: true })
    @IsOptional()
    @IsArray()
    readonly invoiceItems?: IInvoiceItem[];

    @ApiPropertyOptional({ type: () => Array, isArray: true })
    @IsOptional()
    @IsArray()
    readonly teams?: IOrganizationTeam[];

    @ApiPropertyOptional({ type: () => Object })
    @IsOptional()
    readonly organizationSprint?: IOrganizationSprint;

    @ApiPropertyOptional({ type: () => Object })
    @IsOptional()
    readonly organization?: IOrganization;

}