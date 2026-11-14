import { forwardRef, Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { EmployeeModule } from '../employee/employee.module';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { EmployeePlaceholderController } from './employee-placeholder.controller';
import { EmployeePlaceholderService } from './employee-placeholder.service';
import { EmployeePlaceholderTransferService } from './employee-placeholder-transfer.service';

/**
 * Members without an account (ever-co/ever-gauzy#11913). The claim invitation is created through the command bus, so
 * this module does not import the invitation module, which imports it for the transfer a claim's acceptance runs.
 */
@Module({
	imports: [CqrsModule, forwardRef(() => EmployeeModule), forwardRef(() => RolePermissionModule)],
	controllers: [EmployeePlaceholderController],
	providers: [EmployeePlaceholderService, EmployeePlaceholderTransferService],
	exports: [EmployeePlaceholderTransferService]
})
export class EmployeePlaceholderModule {}
