import { defineConfig } from 'vitest/config';

// Most tests are plain logic. The look tests render a few components to HTML through react native web,
// so React Native resolves to it here.
export default defineConfig({
  resolve: { alias: { 'react-native': 'react-native-web' } },
});
