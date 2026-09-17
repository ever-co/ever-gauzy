import { CreatePaymentTables1791000000280 } from './1791000000280-CreatePaymentTables';
import { CreateRefundLineTable1791000000285 } from './1791000000285-CreateRefundLineTable';
import { AddPaymentDomainForeignKeys1791000000290 } from './1791000000290-AddPaymentDomainForeignKeys';

export { CreatePaymentTables1791000000280 } from './1791000000280-CreatePaymentTables';
export { CreateRefundLineTable1791000000285 } from './1791000000285-CreateRefundLineTable';
export { AddPaymentDomainForeignKeys1791000000290 } from './1791000000290-AddPaymentDomainForeignKeys';

/**
 * The plugin's migration set, in run order.
 *
 * The first file creates the seven tables of the domain; the second creates `refund_line`, which the
 * breakdown of a refund is rows in; the third constrains the columns this domain owns on the core
 * tables, which exist only once the core set has run. The second file sits at `←285` because it is the
 * next free tick inside this package's own sub-range — the plan reserves `←345` for the refund-line
 * file, but this package's shipped set occupies `←280`–`←299`, and the file still runs exactly where
 * the plan intends it, between the table set and the constraint set.
 *
 * The array lives here rather than beside the migration classes so that every file in the
 * `migrations/` directory is a migration and nothing else.
 */
export const ALL_PAYMENT_MIGRATIONS = [
	CreatePaymentTables1791000000280,
	CreateRefundLineTable1791000000285,
	AddPaymentDomainForeignKeys1791000000290
];
