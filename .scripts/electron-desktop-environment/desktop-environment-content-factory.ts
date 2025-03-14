import { CommonEnvironmentContent } from './concrete-environment-content/common-environment-content';
import { DesktopTimerEnvironmentContent } from './concrete-environment-content/desktop-timer-environment-content';
import { DesktopEnvironmentContent } from './concrete-environment-content/desktop-environment-content';
import { DesktopServerEnvironmentContent } from './concrete-environment-content/desktop-server-environment-content';
import { DesktopApiServerEnvironmentContent } from './concrete-environment-content/desktop-api-server-environment-content';
import { IDesktopEnvironment } from './interfaces/i-desktop-environment';
import { AgentEnvironmentContent } from './concrete-environment-content/agent-environment-content';

export class DesktopEnvironmentContentFactory {
	public static generate(
		desktop: string,
		environment: Partial<IDesktopEnvironment>
	) {
		const common = new CommonEnvironmentContent();
		switch (desktop) {
			case 'desktop-timer':
				const desktopTimer = new DesktopTimerEnvironmentContent();
				return common
					.generate(environment)
					.concat(desktopTimer.generate(environment));
			case 'desktop':
				const desktopApp = new DesktopEnvironmentContent();
				return common
					.generate(environment)
					.concat(desktopApp.generate(environment));
			case 'server':
				const server = new DesktopServerEnvironmentContent();
				return common
					.generate(environment)
					.concat(server.generate(environment));
			case 'server-api':
				const apiServer = new DesktopApiServerEnvironmentContent();
				return common
					.generate(environment)
					.concat(apiServer.generate(environment));
			case 'gauzy-agent':
				const agent = new AgentEnvironmentContent();
				return common
					.generate(environment)
					.concat(agent.generate(environment));
			default:
				break;
		}
	}
}
