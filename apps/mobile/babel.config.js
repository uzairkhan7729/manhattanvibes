module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Reanimated 4 split its worklets engine into 'react-native-worklets'.
    // The babel plugin moved here too. Must be LAST in the plugins list.
    plugins: ['react-native-worklets/plugin'],
  };
};
