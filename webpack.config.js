const createExpoWebpackConfigAsync = require('@expo/webpack-config');
const path = require('path');
const webpack = require('webpack');
const dotenv = require('dotenv');

module.exports = async function (env, argv) {
  // Load environment variables from .env file
  const env_file = dotenv.config().parsed || {};
  
  // Create environment variables prefixed with EXPO_PUBLIC_ for the web
  const exposedVariables = {};
  Object.keys(env_file).forEach(key => {
    exposedVariables[`process.env.${key}`] = JSON.stringify(env_file[key]);
    exposedVariables[`process.env.EXPO_PUBLIC_${key}`] = JSON.stringify(env_file[key]);
  });
  
  const config = await createExpoWebpackConfigAsync(env, argv);

  // Customize the config for web
  config.resolve.alias = {
    ...config.resolve.alias,
    'react-native$': 'react-native-web',
    'react-native-web': path.resolve(__dirname, 'node_modules/react-native-web'),
    '@env': path.resolve(__dirname, '.env'),
  };

  // Add DefinePlugin to inject environment variables
  config.plugins.push(
    new webpack.DefinePlugin(exposedVariables)
  );

  // Add web-specific rules
  config.module.rules.push({
    test: /\.(js|jsx|ts|tsx)$/,
    exclude: /node_modules/,
    use: {
      loader: 'babel-loader',
      options: {
        presets: ['@babel/preset-env', '@babel/preset-react'],
        plugins: ['@babel/plugin-proposal-class-properties'],
      },
    },
  });

  return config;
}; 