import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import KintonePlugin from '@kintone/webpack-plugin-kintone-plugin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const entry = {
  desktop: './src/js/desktop.js',
  mobile: './src/js/mobile.js',
  config: './src/js/config.js',
};
export const output = {
  path: resolve(__dirname, 'plugin', 'js'),
  filename: '[name].js',
};
export const plugins = [
  new KintonePlugin({
    manifestJSONPath: './plugin/manifest.json',
    privateKeyPath: './private.ppk',
    // pluginZipPath: (id, manifest) => `${id}.${manifest.version}.plugin.zip`,
    pluginZipPath: './dist/plugin.zip',
  }),
];

export default {
  entry,
  output,
  plugins,
};
