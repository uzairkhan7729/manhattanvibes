module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // react-native-reanimated requires its plugin to be last in the list,
    // otherwise worklets compile to no-ops at runtime.
    plugins: ['react-native-reanimated/plugin'],
  };
};
