import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';
import { Column, Entity, JoinColumn, ManyToOne, RelationId } from 'typeorm';
import {
	IPayrollItem,
  	PayrollItemCategoryEnum,
    	PayrollItemTypeEnum
      } from '@gauzy/contracts';
      import { TenantOrganizationBaseEntity } from '../core/entities/internal';
      import { Employee } from '../employee/employee.entity';
      import { PayrollRun } from '../payroll-run/payroll-run.entity';

      /**
       * Entity representing a single earning or deduction line item within a Payroll Run
        */
        @Entity('payroll_item')
        export class PayrollItem extends TenantOrganizationBaseEntity implements IPayrollItem {

        	@ApiProperty({ type: () => String })
          	@IsEnum(PayrollItemTypeEnum)
            	@IsNotEmpty()
              	@Column({ type: 'varchar' })
                	type: PayrollItemTypeEnum;

                  	@ApiProperty({ enum: PayrollItemCategoryEnum })
                    	@IsEnum(PayrollItemCategoryEnum)
                      	@IsNotEmpty()
                        	@Column({ type: 'varchar' })
                          	category: PayrollItemCategoryEnum;

                            	@ApiPropertyOptional({ type: () => String })
                              	@IsOptional()
                                	@IsString()
                                  	@Column({ nullable: true })
                                    	description?: string;

                                      	@ApiProperty({ type: () => Number })
                                        	@IsNumber()
                                          	@Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
                                            	amount: number;

                                              	@ApiPropertyOptional({ type: () => Number })
                                                	@IsOptional()
                                                  	@IsNumber()
                                                    	@Column({ type: 'numeric', precision: 10, scale: 4, nullable: true })
                                                      	quantity?: number;

                                                        	@ApiPropertyOptional({ type: () => Number })
                                                          	@IsOptional()
                                                            	@IsNumber()
                                                              	@Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
                                                                	unitPrice?: number;

                                                                  	@ApiProperty({ type: () => Boolean })
                                                                    	@IsBoolean()
                                                                      	@Column({ default: true })
                                                                        	taxable: boolean;

                                                                          	/*
                                                                            	|--------------------------------------------------------------------------
                                                                              	| @ManyToOne — PayrollRun
                                                                                	|--------------------------------------------------------------------------
                                                                                  	*/

                                                                                    	@ApiProperty({ type: () => PayrollRun })
                                                                                      	@ManyToOne(() => PayrollRun, (run) => run.items, {
                                                                                        		onDelete: 'CASCADE'
                                                                                            	})
                                                                                              	@JoinColumn()
                                                                                                	payrollRun?: PayrollRun;

                                                                                                  	@ApiProperty({ type: () => String })
                                                                                                    	@IsNotEmpty()
                                                                                                      	@IsUUID()
                                                                                                        	@RelationId((item: PayrollItem) => item.payrollRun)
                                                                                                          	@Column()
                                                                                                            	payrollRunId: string;
                                                                                                              
                                                                                                              	/*
                                                                                                                	|--------------------------------------------------------------------------
                                                                                                                  	| @ManyToOne — Employee
                                                                                                                    	|--------------------------------------------------------------------------
                                                                                                                      	*/
                                                                                                                        
                                                                                                                        	@ApiPropertyOptional({ type: () => Employee })
                                                                                                                          	@ManyToOne(() => Employee, { nullable: true, onDelete: 'SET NULL' })
                                                                                                                            	@JoinColumn()
                                                                                                                              	employee?: Employee;
                                                                                                                                
                                                                                                                                	@ApiPropertyOptional({ type: () => String })
                                                                                                                                  	@IsOptional()
                                                                                                                                    	@IsUUID()
                                                                                                                                      	@RelationId((item: PayrollItem) => item.employee)
                                                                                                                                        	@Column({ nullable: true })
                                                                                                                                          	employeeId?: string;
                                                                                                                                            }
