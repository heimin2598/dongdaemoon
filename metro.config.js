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
  // Expo SDK 54의 Metro resolver는 기본적으로 package.json `exports`를 따르지만,
  // Firebase 10.x의 exports 매핑이 RN 엔트리(`index.rn.js`)로 라우팅되지 않아
  // "Component auth has not been registered yet" 에러가 발생함. exports 해석을 끄고
  // RN 환경에서 `react-native` field 기반의 기존 resolver 동작으로 폴백시킴.
  unstable_enablePackageExports: false,
};

module.exports = config;
