import { IntersectionType, PartialType, PickType } from '@nestjs/swagger';
import { IPayment } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from './../../core/dto';
import { Payment } from '../payment.entity';
import { EmployeeFeatureDTO } from '../../employee/dto';

export class PaymentDTO
	extends IntersectionType(
		TenantOrganizationBaseDTO,
		PartialType(EmployeeFeatureDTO),
		PickType(Payment, [
			'amount',
			'paymentMethod',
			'paymentDate',
			'overdue',
			'note',
			'currency',
			'project',
			'projectId',
			'organizationContact',
			'organizationContactId',
			'invoice',
			'invoiceId',
			'tags'
		] as const)
	)
	implements IPayment {}
