import colors from 'tailwindcss/colors';
import plugin from 'tailwindcss/plugin';

// Every themed colour is a CSS variable, so light and dark mode share class names:
// bg-ink-50 is always the page and text-ink-900 is always primary text.
const STEPS = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'];

const PALETTE = {
  light: {
    ink: ['#f8f5ee', '#efeadf', '#e2dccd', '#cfc7b4', '#a39b88', '#7d7565', '#5f584b', '#47413a', '#332e29', '#24201c', '#16130f'],
    brand: ['#eef4ee', '#d9e7d9', '#b5cfb6', '#8bb28e', '#5f9265', '#3f7748', '#2f6139', '#264e2f', '#1f3f27', '#183220', '#0f2215'],
    surface: '#fffdf8',
    'on-accent': '#ffffff',
    clay: '#c2673f',
  },
  dark: {
    ink: ['#171512', '#221f1b', '#2f2b25', '#433d35', '#6b6356', '#958c7c', '#b4ab9a', '#cdc5b5', '#e0d9cb', '#efe9dd', '#fbf8f1'],
    brand: ['#16241a', '#1c3022', '#28452f', '#3c6545', '#5a8a63', '#78a880', '#93c09a', '#b0d4b5', '#cde5d0', '#e6f2e7', '#f3f9f3'],
    surface: '#1d1a16',
    'on-accent': '#10140f',
    clay: '#e08b62',
  },
};

// Status hues use Tailwind's scales; dark mode flips them so pale tints become deep fills.
const STATUS = ['red', 'rose', 'amber', 'emerald'];

const rgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
};

function cssVars(mode) {
  const p = PALETTE[mode];
  const vars = {};
  for (const name of ['ink', 'brand']) p[name].forEach((hex, i) => (vars[`--${name}-${STEPS[i]}`] = rgb(hex)));
  for (const name of ['surface', 'on-accent', 'clay']) vars[`--${name}`] = rgb(p[name]);
  for (const name of STATUS) {
    const scale = STEPS.map((s) => colors[name][s]);
    if (mode === 'dark') scale.reverse();
    scale.forEach((hex, i) => (vars[`--${name}-${STEPS[i]}`] = rgb(hex)));
  }
  return vars;
}

const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;
const scale = (name) => Object.fromEntries(STEPS.map((s) => [s, v(`${name}-${s}`)]));

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
        display: ['Fraunces', 'Georgia', 'serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        surface: v('surface'),
        'on-accent': v('on-accent'),
        clay: v('clay'),
        ink: scale('ink'),
        brand: scale('brand'),
        ...Object.fromEntries(STATUS.map((name) => [name, scale(name)])),
      },
      boxShadow: {
        card: '0 1px 2px rgba(36, 32, 28, 0.04), 0 4px 16px -8px rgba(36, 32, 28, 0.12)',
        lift: '0 2px 4px rgba(36, 32, 28, 0.06), 0 12px 28px -12px rgba(36, 32, 28, 0.22)',
      },
    },
  },
  plugins: [
    plugin(({ addBase }) => {
      addBase({ ':root': cssVars('light'), '.dark': cssVars('dark') });
    }),
  ],
};
