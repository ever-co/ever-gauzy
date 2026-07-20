import { Given } from '../../support/bdd';
import * as loginPage from '../../support/pages/Login.po';
import * as dashboardPage from '../../support/pages/Dashboard.po';
import { LoginPageData } from '../../../src/support/Base/pagedata/LoginPageData';
import { CustomCommands } from '../../support/commands';

/**
 * Shared step definitions reused across every feature.
 *
 * playwright-bdd loads all step files once and requires each step's Gherkin text to be UNIQUE across
 * the whole `steps` glob, so genuinely-common steps (the default-user login that every feature's
 * Background needs) live here and are authored exactly once. Feature-specific steps stay in their own
 * <Feature>.steps.ts file with feature-specific wording so they never collide. Runtime is identical to
 * the plain specs — this calls the same CustomCommands.login the migrated specs used.
 */
Given('I am logged in as the default user', async () => {
	await CustomCommands.login(loginPage, LoginPageData, dashboardPage);
});
