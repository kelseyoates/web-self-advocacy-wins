const createExpoWebpackConfigAsync = require('@expo/webpack-config');
const path = require('path');
const webpack = require('webpack');
const dotenv = require('dotenv');
const { DefinePlugin } = require('webpack');

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

  // Replace %PUBLIC_URL% with empty string in HTML template
  config.plugins.forEach(plugin => {
    if (plugin.constructor.name === 'HtmlWebpackPlugin') {
      plugin.userOptions.templateParameters = {
        ...plugin.userOptions.templateParameters,
        PUBLIC_URL: ''
      };
    }
  });

  // Add the DefinePlugin to replace process.env references
  config.plugins.push(
    new DefinePlugin({
      'process.env.PUBLIC_URL': JSON.stringify('')
    })
  );

  // Add a rule to copy public assets to output
  config.plugins.push({
    apply: (compiler) => {
      compiler.hooks.afterEmit.tap('CopyPublicAssets', (compilation) => {
        const fs = compiler.outputFileSystem;
        // Copy favicon.ico and manifest.json to root of build directory
        try {
          const faviconSource = path.resolve(__dirname, 'assets/favicon.ico');
          const faviconDest = path.resolve(compiler.outputPath, 'favicon.ico');
          
          const manifestSource = path.resolve(__dirname, 'web/manifest.json');
          const manifestDest = path.resolve(compiler.outputPath, 'manifest.json');
          
          if (fs.copyFileSync) {
            // Use webpack's fs if available
            fs.copyFileSync(faviconSource, faviconDest);
            fs.copyFileSync(manifestSource, manifestDest);
          } else {
            // Fallback to native fs
            require('fs').copyFileSync(faviconSource, faviconDest);
            require('fs').copyFileSync(manifestSource, manifestDest);
          }
        } catch (error) {
          console.error('Error copying public assets:', error);
        }
      });
    }
  });

  return config;
}; 