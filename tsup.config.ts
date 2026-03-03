import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  splitting: false,
  external: ['react', 'react-dom'],
  sourcemap: true,
  clean: true,
  target: 'es2020',
  tsconfig: 'tsconfig.json',
});
