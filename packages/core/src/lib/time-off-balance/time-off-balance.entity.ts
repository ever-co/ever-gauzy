import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Column, Entity, Index, ManyToOne, RelationId } from 'typeorm';
import { ITimeOffBalance } from '@gauzy/contracts';
import { TenantOrganizationBaseEntity } from '../core/entities/internal';
import { Employee } from '../employee/employee.entity';
import { TimeOffPolicy } from '../time-off-policy/time-off-policy.entity';

/**
 * Tracks leave balance per employee per policy per year.
  * Issue: https://github.com/ever-co/ever-gauzy/issues/314
   */
   @Entity('time_off_balance')
   export class TimeOffBalance
   	extends TenantOrganizationBaseEntity
    	implements ITimeOffBalance {

      	@ApiProperty({ type: () => Employee })
        	@ManyToOne(() => Employee, { onDelete: 'CASCADE' })
          	employee?: Employee;

            	@ApiProperty({ type: () => String })
              	@IsNotEmpty()
                	@IsString()
                  	@RelationId((it: TimeOffBalance) => it.employee)
                    	@Index()
                      	@Column()
                        	employeeId: string;

                          	@ApiProperty({ type: () => TimeOffPolicy })
                            	@ManyToOne(() => TimeOffPolicy, { onDelete: 'CASCADE' })
                              	policy?: TimeOffPolicy;

                                	@ApiProperty({ type: () => String })
                                  	@IsNotEmpty()
                                    	@IsString()
                                      	@RelationId((it: TimeOffBalance) => it.policy)
                                        	@Index()
                                          	@Column()
                                            	policyId: string;

                                              	@ApiProperty({ type: () => Number, description: 'Fiscal/calendar year' })
                                                	@IsNotEmpty()
                                                  	@IsInt()
                                                    	@Min(2000)
                                                      	@Index()
                                                        	@Column({ type: 'int' })
                                                          	year: number;

                                                            	@ApiProperty({ type: () => Number, description: 'Days accrued this year' })
                                                              	@IsNotEmpty()
                                                                	@IsNumber()
                                                                  	@Min(0)
                                                                    	@Column({ type: 'decimal', precision: 6, scale: 2, default: 0 })
                                                                      	accrued: number;

                                                                        	@ApiProperty({ type: () => Number, description: 'Days taken (approved requests)' })
                                                                          	@IsNotEmpty()
                                                                            	@IsNumber()
                                                                              	@Min(0)
                                                                                	@Column({ type: 'decimal', precision: 6, scale: 2, default: 0 })
                                                                                  	taken: number;

                                                                                    	@ApiPropertyOptional({ type: () => Number, description: 'Days carried from prior year' })
                                                                                      	@IsOptional()
                                                                                        	@IsNumber()
                                                                                          	@Min(0)
                                                                                            	@Column({ type: 'decimal', precision: 6, scale: 2, default: 0 })
                                                                                              	carriedForward: number;

                                                                                                	@ApiProperty({ type: () => Number, description: 'Remaining = accrued + carriedForward - taken' })
                                                                                                  	@IsNotEmpty()
                                                                                                    	@IsNumber()
                                                                                                      	@Column({ type: 'decimal', precision: 6, scale: 2, default: 0 })
                                                                                                        	remaining: number;
                                                                                                          }
