import { IIconGeneratorBase } from './i-icon-generator-base';

export interface IIconGenerator extends IIconGeneratorBase {
	checkUrlValidity(urlString: string): boolean;

	downloadImage(): Promise<string | null>;

	resizeAndConvert(filePath: string): Promise<void>;
}
