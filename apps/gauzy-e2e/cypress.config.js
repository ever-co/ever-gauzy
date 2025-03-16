const { defineConfig } = require('cypress');

module.exports = defineConfig({
    projectId: "2n3iur",
    fileServerFolder: ".",
    fixturesFolder: "./src/fixtures",
    downloadsFolder: "../../dist/cypress/apps/gauzy-e2e/downloads",
    videosFolder: "../../dist/cypress/apps/gauzy-e2e/videos",
    screenshotsFolder: "../../dist/cypress/apps/gauzy-e2e/screenshots",
    video: false,
    chromeWebSecurity: false,
    viewportWidth: 1920,
    viewportHeight: 1080,
    defaultCommandTimeout: 10000,
    pageLoadTimeout: 10000,
    taskTimeout: 10000,
    requestTimeout: 10000,
    execTimeout: 5000,
    responseTimeout: 20000,
    retries: {
        runMode: 1,
        openMode: 0
    },
    env: {
        coverage: false,
        codeCoverage: {
            url: "http://localhost:3001/__coverage__"
        }
    },
    e2e: {
        baseUrl: "http://localhost:4200",
        specPattern: "./src/e2e/**/*.{ts,tsx}",
        supportFile: "./src/support/index.ts",
        setupNodeEvents(on, config) {
            return require('./src/plugins/index')(on, config);
        }
    }
});
