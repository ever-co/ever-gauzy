import { IValidation, IValidationConfig } from '../../interfaces/validation.interface';
import { DynamicSelectorValidation } from './dynamic-selector-factory.validator';

export class SelectorValidatorFactory {
	public static createValidators(config: IValidationConfig[]): IValidation[] {
		return config.map(
			({ service: service, requireField }) =>
				new DynamicSelectorValidation(service, requireField)
		);
	}
}
