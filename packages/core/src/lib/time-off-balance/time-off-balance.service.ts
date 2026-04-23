import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ITimeOffBalance, ITimeOffBalanceFindInput } from '@gauzy/contracts';
import { TimeOffBalance } from './time-off-balance.entity';

/**
 * Service for managing employee leave balances.
  * Handles allocation, deduction, reversal and carry-forward of leave days.
   * Issue: https://github.com/ever-co/ever-gauzy/issues/314
    */
    @Injectable()
    export class TimeOffBalanceService {
    	constructo
      		@InjectRepository(TimeOffBalance)
          		private readonly repo: Repository<TimeOffBalance>
              	) {}

                	/** Find existing balance or create a zeroed record. */
                  	async findOrCreate(input: {
                    		employeeId: string;
                        		policyId: string;
                            		year: number;
                                		tenantId: string;
                                    		organizationId: string;
                                        	}): Promise<ITimeOffBalance> {
                                          		const { employeeId, policyId, year, tenantId, organizationId } = input;
                                              		let balance = await this.repo.findOne({ where: { employeeId, policyId, year, tenantId, organizationId } });
                                                  		if (!balance) {
                                                      			balance = this.repo.create({ employeeId, policyId, year, tenantId, organizationId, accrued: 0, taken: 0, carriedForward: 0, remaining: 0 });
                                                            			await this.repo.save(balance);
                                                                  		}
                                                                      		return balance;
                                                                          	}

                                                                            	/** Return all balances matching the given filter criteria. */
                                                                              	async findAll(filter: ITimeOffBalanceFindInput): Promise<ITimeOffBalance[]> {
                                                                                		const where: Record<string, unknown> = {};
                                                                                    		if (filter.employeeId) where['employeeId'] = filter.employeeId;
                                                                                        		if (filter.policyId) where['policyId'] = filter.policyId;
                                                                                            		if (filter.year) where['year'] = filter.year;
                                                                                                		if (filter.tenantId) where['tenantId'] = filter.tenantId;
                                                                                                    		if (filter.organizationId) where['organizationId'] = filter.organizationId;
                                                                                                        		return this.repo.find({ where, relations: ['policy'] });
                                                                                                            	}
                                                                                                              
                                                                                                              	/** Set the number of accrued days and recalculate remaining. */
                                                                                                                	async allocate(employeeId: string, policyId: string, year: number, days: number, tenantId: string, organizationId: string): Promise<ITimeOffBalance> {
                                                                                                                  		const balance = await this.findOrCreate({ employeeId, policyId, year, tenantId, organizationId });
                                                                                                                      		balance.accrued = days;
                                                                                                                          		balance.remaining = Number(balance.accrued) + Number(balance.carriedForward) - Number(balance.taken);
                                                                                                                              		return this.repo.save(balance as TimeOffBalance);
                                                                                                                                  	}
                                                                                                                                    
                                                                                                                                    	/** Deduct days when a time-off request is approved. */
                                                                                                                                      	async deduct(employeeId: string, policyId: string, year: number, days: number, tenantId: string, organizationId: string): Promise<ITimeOffBalance> {
                                                                                                                                        		const balance = await this.repo.findOne({ where: { employeeId, policyId, year, tenantId, organizationId } });
                                                                                                                                            		if (!balance) throw new NotFoundException(`TimeOffBalance not found for employee ${employeeId}, policy ${policyId}, year ${year}`);
                                                                                                                                                		balance.taken = Number(balance.taken) + days;
                                                                                                                                                    		balance.remaining = Number(balance.accrued) + Number(balance.carriedForward) - Number(balance.taken);
                                                                                                                                                        		return this.repo.save(balance);
                                                                                                                                                            	}
                                                                                                                                                              
                                                                                                                                                              	/** Reverse a deduction when an approved request is cancelled. */
                                                                                                                                                                	async reverse(employeeId: string, policyId: string, year: number, days: number, tenantId: string, organizationId: string): Promise<ITimeOffBalance> {
                                                                                                                                                                  		const balance = await this.repo.findOne({ where: { employeeId, policyId, year, tenantId, organizationId } });
                                                                                                                                                                      		if (!balance) throw new NotFoundException(`TimeOffBalance not found for employee ${employeeId}, policy ${policyId}, year ${year}`);
                                                                                                                                                                          		balance.taken = Math.max(0, Number(balance.taken) - days);
                                                                                                                                                                              		balance.remaining = Number(balance.accrued) + Number(balance.carriedForward) - Number(balance.taken);
                                                                                                                                                                                  		return this.repo.save(balance);
                                                                                                                                                                                      	}
                                                                                                                                                                                        
                                                                                                                                                                                        	/**
                                                                                                                                                                                          	 * Carry unused days from one year into the next for all employees under a policy.
                                                                                                                                                                                             	 * @param maxCarryForwardDays 0 means unlimited carry-forward.
                                                                                                                                                                                               	 */
                                                                                                                                                                                                 	async carryForward(policyId: string, fromYear: number, toYear: number, maxCarryForwardDays: number, tenantId: string, organizationId: string): Promise<void> {
                                                                                                                                                                                                  		const sourceBalances = await this.repo.find({ where: { policyId, year: fromYear, tenantId, organizationId } });
                                                                                                                                                                                                      		for (const src of sourceBalances) {
                                                                                                                                                                                                          			let carryDays = Math.max(0, Number(src.remaining));
                                                                                                                                                                                                                			if (maxCarryForwardDays > 0) carryDays = Math.min(carryDays, maxCarryForwardDays);
                                                                                                                                                                                                                      			const dest = await this.findOrCreate({ employeeId: src.employeeId, policyId, year: toYear, tenantId, organizationId });
                                                                                                                                                                                                                            			dest.carriedForward = carryDays;
                                                                                                                                                                                                                                  			dest.remaining = Number(dest.accrued) + carryDays - Number(dest.taken);
                                                                                                                                                                                                                                        			await this.repo.save(dest as TimeOffBalance);
                                                                                                                                                                                                                                              		}
                                                                                                                                                                                                                                                  	}
                                                                                                                                                                                                                                                    
                                                                                                                                                                                                                                                    	/** Get all balance records for an employee across all policies for a given year. */
                                                                                                                                                                                                                                                      	async getStatsByEmployee(employeeId: string, year: number, tenantId: string, organizationId: string): Promise<ITimeOffBalance[]> {
                                                                                                                                                                                                                                                        		return this.repo.find({ where: { employeeId, year, tenantId, organizationId }, relations: ['policy'] });
                                                                                                                                                                                                                                                            	}
                                                                                                                                                                                                                                                              }
