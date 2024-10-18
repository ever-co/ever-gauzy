export interface IValidation {
	validate(): boolean;
	setError<T>(error?: T): void;
}

export interface IValidationConfig {
	service: any;
	requireField: boolean;
}
