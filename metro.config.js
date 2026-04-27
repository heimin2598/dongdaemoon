const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// SVG를 React 컴포넌트로 import할 수 있도록 설정
config.transformer = {
  ...config.transformer,
  babelTransformerPath: require.resolve('react-native-svg-transformer/expo'),
};
config.resolver = {
  ...config.resolver,
  assetExts: config.resolver.assetExts.filter((ext) => ext !== 'svg'),
  // Firebase JS SDK가 .cjs 엔트리를 일부 사용하므로 cjs 확장을 sourceExts에 추가
  sourceExts: [...config.resolver.sourceExts, 'svg', 'cjs'],
};

module.exports = config;
