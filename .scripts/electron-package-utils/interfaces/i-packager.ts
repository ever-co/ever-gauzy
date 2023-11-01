import { IPackage } from './i-package';

export interface IPackager {
	prepare(pkg: IPackage): IPackage;
}
