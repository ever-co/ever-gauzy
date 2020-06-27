import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../user/user.entity';
import { UserService } from '../user/user.service';
import { EstimateEmailController } from './estimate-email.controller';
import { EstimateEmailService } from './estimate-email.service';
import { Organization } from '../organization/organization.entity';
import { Invoice } from '../invoice/invoice.entity';
import { EstimateEmail } from './estimate-email.entity';

@Module({
	imports: [
		TypeOrmModule.forFeature([User, EstimateEmail, Invoice, Organization])
	],
	controllers: [EstimateEmailController],
	providers: [EstimateEmailService, UserService],
	exports: [EstimateEmailService, UserService]
})
export class EstimateEmailModule {}
