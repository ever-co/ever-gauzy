import { IValidation, IValidationConfig } from '../../interfaces/validation.interface';
import { SelectorValidatorFactory } from './selector-factory.validator';

export class SelectorValidator {
	private fields: IValidation[] = [];

	constructor(readonly config: IValidationConfig[]) {
		this.fields = SelectorValidatorFactory.createValidators(config);
	}

	public validateAll(): boolean {
		return this.fields.reduce((isValid, field) => {
			const fieldValid = field.validate();
			return isValid && fieldValid;
		}, true);
	}
}
