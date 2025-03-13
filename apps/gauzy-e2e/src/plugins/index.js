const webpack = require('@cypress/webpack-preprocessor');
const path = require('path');

const webpackOptions = {
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: [
                    {
                        loader: 'ts-loader',
                        options: {
                            transpileOnly: true,
                            configFile: path.resolve(__dirname, '../tsconfig.json')
                        }
                    }
                ],
                exclude: /node_modules/
            }
        ]
    },
    resolve: {
        extensions: ['.ts', '.tsx', '.js', '.jsx'],
        modules: ['node_modules']
    },
    output: {
        filename: 'bundle.js',
        path: path.resolve(__dirname, 'dist')
    }
};

module.exports = (on, config) => {
    on('file:preprocessor', webpack({
        webpackOptions,
        watchOptions: {}
    }));

    // Добавляем поддержку TypeScript
    on('before:browser:launch', (browser = {}, launchOptions) => {
        if (browser.name === 'chrome' || browser.name === 'chromium') {
            launchOptions.args.push('--disable-dev-shm-usage');
            return launchOptions;
        }
        return launchOptions;
    });

    return config;
};
