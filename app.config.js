const { getDefaultConfig } = require('@expo/metro-config');

module.exports = {
  name: "Self-Advocacy Wins",
  slug: "self-advocacy-wins",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "light",
  newArchEnabled: true,
  scheme: "selfadvocatelink",
  splash: {
    image: "./assets/splash.png",
    resizeMode: "contain",
    backgroundColor: "#ffffff"
  },
  updates: {
    fallbackToCacheTimeout: 0
  },
  assetBundlePatterns: [
    "**/*"
  ],
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.selfadvocacywins.app",
    associatedDomains: [
      "applinks:selfadvocatelink.app"
    ],
    buildNumber: "1",
    googleServicesFile: "./GoogleService-Info.plist",
    infoPlist: {
      NSCameraUsageDescription: "This app uses the camera to let you take photos for your profile and documents.",
      NSPhotoLibraryUsageDescription: "This app accesses your photos to let you share them in your documents.",
      NSPhotoLibraryAddUsageDescription: "This app saves photos to your library when you download documents.",
      NSMicrophoneUsageDescription: "This app uses the microphone to record audio for your documents.",
      ITSAppUsesNonExemptEncryption: false
    }
  },
  android: {
    package: "com.koates89.selfadvocacywins",
    versionCode: 1,
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#FFFFFF"
    },
    googleServicesFile: "./google-services.json"
  },
  web: {
    favicon: "./assets/favicon.ico",
    bundler: "metro",
    output: "static",
    build: {
      babel: {
        include: ["@expo/vector-icons"]
      }
    },
    meta: {
      favicon: "./assets/favicon.ico"
    },
    template: './web/index.html'
  },
  plugins: [
    [
      "expo-camera",
      {
        "cameraPermission": "Allow $(PRODUCT_NAME) to access your camera."
      }
    ],
    [
      "expo-image-picker",
      {
        "photosPermission": "Allow $(PRODUCT_NAME) to access your photos",
        "cameraPermission": "Allow $(PRODUCT_NAME) to access your camera"
      }
    ],
    "@react-native-firebase/app",
    "@react-native-firebase/app-check"
  ],
  owner: "koates89"
}; 