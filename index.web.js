import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

// Register the app for web
AppRegistry.registerComponent(appName, () => App);

// Set up the web-specific rendering
if (window.document) {
  AppRegistry.runApplication(appName, {
    rootTag: document.getElementById('root') || document.getElementById('app'),
  });
} 