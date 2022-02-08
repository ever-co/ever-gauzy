import { CurrenciesEnum } from "@gauzy/contracts";
import { ApiProperty } from "@nestjs/swagger";
import { IsDate, IsNotEmpty, IsNumber,IsOptional,IsString,Max,Min} from "class-validator";

export class EmployeeRecurringExpenseDTO {

    @ApiProperty({ type: () => Number, minimum: 1, maximum: 31 })
    @IsNumber()
    @IsNotEmpty()
    @Min(1)
    @Max(31)
    readonly startDay: number;

    @ApiProperty({ type: () => Number, minimum: 1, maximum: 12 })
    @IsNumber()
    @IsNotEmpty()
    @Min(1)
    @Max(12)
    readonly startMonth: number;

    @ApiProperty({ type: () => Number, minimum: 1 })
    @IsNumber()
    @IsNotEmpty()
    @Min(0)
    readonly startYear: number;

    @ApiProperty({ type: () => Date })
    @IsDate()
    readonly startDate: Date;

    @ApiProperty({ type: () => Number, minimum: 1, maximum: 31 })
    @IsNumber()
    @IsOptional()
    @Min(1)
    @Max(31)
    readonly endDay: number;

    @ApiProperty({ type: () => Number, minimum: 1, maximum: 12 })
    @IsNumber()
    @IsOptional()
    @Min(1)
    @Max(12)
    readonly endMonth: number;

    @ApiProperty({ type: () => Number, minimum: 1 })
    @IsNumber()
    @IsOptional()
    @Min(0)
    readonly endYear?: number;

    @ApiProperty({ type: () => Date })
	@IsDate()
	@IsOptional()
	readonly endDate?: Date;

    @ApiProperty({ type: () => String })
	@IsString()
	@IsNotEmpty()
	readonly categoryName: string;
    
    @ApiProperty({ type: () => Number })
	@IsNumber()
	@IsNotEmpty()
	value: number; 

    @ApiProperty({ type: () => String, enum: CurrenciesEnum })
	@IsNotEmpty()
	currency: string;

    @ApiProperty({ type: () => String })
	@IsString()
	@Index()
	@Column({ nullable: true })
	parentRecurringExpenseId?: string;


}