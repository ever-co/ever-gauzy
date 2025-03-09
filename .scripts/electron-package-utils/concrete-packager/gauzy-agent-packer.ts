import { IPackage } from '../interfaces/i-package';
import { IPackager } from '../interfaces/i-packager';
import { env } from '../../env';

export class GauzyAgentPackager implements IPackager {
	public prepare(pkg: IPackage): IPackage {
		pkg.name = env.DESKTOP_TIMER_APP_NAME || pkg.name;
		pkg.productName = env.DESKTOP_TIMER_APP_DESCRIPTION || pkg.productName;
		pkg.description = env.DESKTOP_TIMER_APP_DESCRIPTION || pkg.description;
		pkg.homepage = env.COMPANY_SITE_LINK || pkg.homepage;
		pkg.build.appId = env.DESKTOP_TIMER_APP_ID || pkg.build.appId;
		pkg.build.productName =
			env.DESKTOP_TIMER_APP_DESCRIPTION || pkg.build.productName;
		pkg.build.linux.executableName =
			env.DESKTOP_TIMER_APP_NAME || pkg.build.linux.executableName;
		return pkg;
	}
}
