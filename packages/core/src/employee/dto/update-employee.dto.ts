import { IsEmail, IsNotEmpty } from 'class-validator';
import { Employee } from '../employee.entity';

export class UpdateEmployeeDto extends Employee{

    @IsEmail()
    @IsNotEmpty()
    email : string;

}