module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      'babel-preset-expo',
      require.resolve('nativewind/babel'),
    ],
    plugins: [
      require.resolve('expo-router/babel'),
    ],
  };
};

