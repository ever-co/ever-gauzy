import { IArrowStrategy } from '../strategies/arrow-strategy.interface';
export class Arrow {
  // Define strategy aggregation
  private strategy: IArrowStrategy;
  /**
   * default constructor
   */
  constructor() { }
  /**
   * set strategy
   * @param strategy
   */
  set setStrategy(strategy: IArrowStrategy) {
    this.strategy = strategy;
  }
  /**
   * @param request
   */
  execute(request: any): any {
    return this.strategy.action(request);
  }
}
