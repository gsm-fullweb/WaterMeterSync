// babel.config.js (na raiz do projeto)
module.exports = function (api) {
    api.cache(true);
    return {
      presets: ['babel-preset-expo'],
      plugins: ['nativewind/babel'],
    };
  };
  