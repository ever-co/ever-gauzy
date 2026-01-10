import { IPackage } from '../interfaces/i-package';
import { BasePackager } from './base-packager';
import { env } from '../../env';

export class AgentPackager extends BasePackager {
	public prepare(pkg: IPackage): IPackage {
		pkg.name = env.AGENT_APP_NAME || pkg.name;
		pkg.productName = env.AGENT_APP_DESCRIPTION || pkg.productName;
		pkg.description = env.AGENT_APP_DESCRIPTION || pkg.description;
		pkg.homepage = env.COMPANY_SITE_LINK || pkg.homepage;
		pkg.build.appId = env.AGENT_APP_ID || pkg.build.appId;
		pkg.build.productName =
			env.AGENT_APP_DESCRIPTION || pkg.build.productName;
		pkg.build.linux.executableName =
			env.AGENT_APP_NAME || pkg.build.linux.executableName;

		return pkg;
	}
}
