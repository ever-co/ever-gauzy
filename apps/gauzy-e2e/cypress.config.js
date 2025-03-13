const { defineConfig } = require('cypress');

module.exports = defineConfig({
    "projectId": "2n3iur",
    "fileServerFolder": ".",
    "fixturesFolder": "src/fixtures",
    "integrationFolder": "src/integration",
    "videosFolder": "../../dist/cypress/apps/gauzy-e2e/videos",
    "screenshotsFolder": "../../dist/cypress/apps/gauzy-e2e/screenshots",
    "video": false,
    "videoUploadOnPasses": false,
    "chromeWebSecurity": false,
    "viewportWidth": 1920,
    "viewportHeight": 1080,
    "baseUrl": "http://localhost:4200",
    "defaultCommandTimeout": 10000,
    "pageLoadTimeout": 10000,
    "taskTimeout": 60000,
    "requestTimeout": 10000,
    "execTimeout": 60000,
    "responseTimeout": 10000,
    "retries": {
        "runMode": 1,
        "openMode": 0
    },
    "env": {
        "coverage": false,
        "codeCoverage": {
            "url": "http://localhost:3001/__coverage__"
        }
    },
    "e2e": {
        "specPattern": "src/integration/**/*.{js,jsx,ts,tsx}",
        "supportFile": "src/support/index.ts",
        "setupNodeEvents": (on, config) => {
            return require('./src/plugins/index.js')(on, config);
        },
        "experimentalSessionAndOrigin": true,
        "experimentalModuleSupport": true
    }
});
