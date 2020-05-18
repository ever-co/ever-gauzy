import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RequestApprovalEmployee } from './request-approval-employee.entity';

@Module({
	imports: [TypeOrmModule.forFeature([RequestApprovalEmployee])]
})
export class RequestApprovalEmployeeModule {}
