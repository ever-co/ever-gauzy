import { Env } from '../../env';

export interface IContentGenerator {
	generate(variable: Partial<Env>): string;
}
