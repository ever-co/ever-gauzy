/**
 * Reconcile stock levels request DTO validation.
 *
 * A reconciliation walks the levels of a location, of a variant, or of the whole organization. Every
 * field is optional because "everything the caller may see" is the documented default, and the scope
 * narrows it rather than being required to state it.
 */
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

/** Which level rows a reconciliation walks. */
export class ReconcileStockLevelsDTO {
	/**
	 * Restrict the run to one location.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	warehouseId?: string;

	/**
	 * Restrict the run to one variant.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	variantId?: string;

	/**
	 * How many level rows one run walks. Bounded, because a reconciliation holds a row lock per level
	 * it corrects and an unbounded run would hold the ledger for as long as it took to walk it.
	 */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsInt()
	@Min(1)
	@Max(1000)
	take?: number;
}
