import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, IsDateString } from 'class-validator';
import { Column, Entity, OneToMany } from 'typeorm';
import {
	IPayrollRun,
  	PayrollFrequencyEnum,
    	PayrollRunStatusEnum
      } from '@gauzy/contracts';
      import { TenantOrganizationBaseEntity } from '../core/entities/internal';
      import { PayrollItem } from '../payroll-item/payroll-item.entity';

      /**
       * Entity representing a Payroll Run (one pay-period cycle)
        */
        @Entity('payroll_run')
        export class PayrollRun extends TenantOrganizationBaseEntity implements IPayrollRun {

        	@ApiProperty({ type: () => String })
          	@IsDateString()
            	@IsNotEmpty()
              	@Column()
                	periodStart: Date;

                  	@ApiProperty({ type: () => String })
                    	@IsDateString()
                      	@IsNotEmpty()
                        	@Column()
                          	periodEnd: Date;

                            	@ApiProperty({ type: () => String })
                              	@IsDateString()
                                	@IsNotEmpty()
                                  	@Column()
                                    	payDate: Date;

                                      	@ApiProperty({ enum: PayrollFrequencyEnum })
                                        	@IsEnum(PayrollFrequencyEnum)
                                          	@IsNotEmpty()
                                            	@Column({ type: 'varchar' })
                                              	frequency: PayrollFrequencyEnum;

                                                	@ApiProperty({ enum: PayrollRunStatusEnum })
                                                  	@IsEnum(PayrollRunStatusEnum)
                                                    	@Column({ type: 'varchar', default: PayrollRunStatusEnum.DRAFT })
                                                      	status: PayrollRunStatusEnum;

                                                        	@ApiProperty({ type: () => String })
                                                          	@IsString()
                                                            	@IsNotEmpty()
                                                              	@Column()
                                                                	currency: string;

                                                                  	@ApiProperty({ type: () => Number })
                                                                    	@IsNumber()
                                                                      	@Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
                                                                        	totalGross: number;

                                                                          	@ApiProperty({ type: () => Number })
                                                                            	@IsNumber()
                                                                              	@Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
                                                                                	totalDeductions: number;

                                                                                  	@ApiProperty({ type: () => Number })
                                                                                    	@IsNumber()
                                                                                      	@Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
                                                                                        	totalNet: number;

                                                                                          	@ApiPropertyOptional({ type: () => String })
                                                                                            	@IsOptional()
                                                                                              	@IsString()
                                                                                                	@Column({ nullable: true })
                                                                                                  	notes?: string;
                                                                                                    
                                                                                                    	/*
                                                                                                      	|--------------------------------------------------------------------------
                                                                                                        	| @OneToMany
                                                                                                          	|--------------------------------------------------------------------------
                                                                                                            	*/
                                                                                                              
                                                                                                              	@ApiPropertyOptional({ type: () => PayrollItem, isArray: true })
                                                                                                                	@OneToMany(() => PayrollItem, (item) => item.payrollRun, {
                                                                                                                  		cascade: true
                                                                                                                      	})
                                                                                                                        	items?: PayrollItem[];
                                                                                                                          }
