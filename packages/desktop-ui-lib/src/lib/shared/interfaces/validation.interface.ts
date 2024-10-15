export interface IValidation {
	validate(): boolean;
	setError(): void;
}

export interface IValidationConfig {
	service: any;
	requireField: boolean;
}
