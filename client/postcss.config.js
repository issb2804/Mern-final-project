import { fileURLToPath } from 'node:url';

export default {
  plugins: {
    // Explicit path so the config is found no matter which directory the dev server starts from.
    tailwindcss: { config: fileURLToPath(new URL('./tailwind.config.js', import.meta.url)) },
    autoprefixer: {},
  },
};
