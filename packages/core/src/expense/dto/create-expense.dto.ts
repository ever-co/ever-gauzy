import { IExpenseCategory, IExpenseCreateInput, IOrganization, IOrganizationContact, IOrganizationProject, IOrganizationVendor, ITag, ITenant } from "@gauzy/contracts";
import { ApiProperty } from "@nestjs/swagger";
import { IsObject, IsOptional, IsString } from "class-validator";
import { ExpenseDTO } from "./expense.dto";

export class CreateExpenseDTO extends ExpenseDTO implements IExpenseCreateInput {

    @ApiProperty({ type: () => String, readOnly: true })
    @IsOptional()
    @IsString()
    readonly employeeId?: string;

    @ApiProperty({ type: () => Object, readOnly: true })
    @IsOptional()
    @IsObject()
    readonly category: IExpenseCategory;

    @ApiProperty({ type: () => Object, readOnly: true })
    @IsOptional()
    @IsObject()
    readonly vendor: IOrganizationVendor;

}