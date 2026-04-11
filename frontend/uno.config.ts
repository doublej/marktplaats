import { defineConfig, presetUno, presetIcons } from 'unocss';

export default defineConfig({
	presets: [presetUno(), presetIcons({ scale: 1.2 })],
	theme: {
		fontFamily: {
			sans: ['Source Sans 3', 'system-ui', 'sans-serif']
		},
		colors: {
			gray: {
				50: '#fafafa',
				100: '#f4f4f5',
				200: '#e4e4e7',
				300: '#d4d4d8',
				400: '#a1a1aa',
				500: '#71717a',
				600: '#52525b',
				700: '#3f3f46',
				800: '#27272a',
				900: '#18181b',
				950: '#09090b'
			}
		},
		borderRadius: {
			none: '0',
			sm: '2px',
			DEFAULT: '2px',
			md: '4px',
			lg: '6px'
		}
	},
	shortcuts: {
		'card': 'bg-white dark:bg-gray-900 shadow-sm border border-gray-200 dark:border-gray-800',
		'btn': 'px-4 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 font-medium cursor-pointer hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors',
		'btn-secondary': 'px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-medium cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors',
		'input': 'px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-gray-500 dark:focus:border-gray-400'
	}
});
