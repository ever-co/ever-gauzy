import { IArrowStrategy } from '../strategies/arrow-strategy.interface';

/**
 * The Arrow class is a context that uses a strategy to perform actions.
 */
export class Arrow {
	/**
	 * The strategy instance used to execute actions.
	 */
	private strategy!: IArrowStrategy;

	/**
	 * Sets the strategy to be used by the Arrow instance.
	 * @param strategy - An implementation of IArrowStrategy.
	 */
	setStrategy(strategy: IArrowStrategy): void {
		if (!strategy) {
			throw new Error('Strategy cannot be null or undefined.');
		}
		this.strategy = strategy;
	}

	/**
	 * Executes the action defined by the current strategy.
	 * @param request - The input request data.
	 * @param unitOfTime - The unit of time for moment.js operations.
	 * @returns The result of the strategy action.
	 */
	execute(request: any, unitOfTime: moment.unitOfTime.Base): any {
		if (!this.strategy) {
			throw new Error('Strategy has not been set.');
		}
		return this.strategy.action(request, unitOfTime);
	}
}
