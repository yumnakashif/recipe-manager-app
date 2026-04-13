import type { Config } from 'tailwindcss'

const config = {
  darkMode: 'class',
  content: [
    './src/**/*.{ts,tsx,js,jsx}'
  ],
  prefix: '',
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1440px'
      }
    },
    extend: {
      backgroundImage: {
        'span-bg': 'var(--span-bg)'
      },
      colors: {
        background: 'var(--background)',
        primary: {
          DEFAULT: 'var(--primary)',
          hover: 'var(--button)'
        },
        'button-secondary': 'var(--button-secondary)',
        'button-text': 'var(--button-text)',
        'text-main': 'var(--text-main)',
        'text-secondary': 'var(--text-secondary)',
        'background-secondary': 'var(--background-secondary)',
        secondary: 'var(--secondary)',
        button: 'var(--button)',
        selected: 'var(--selected)',
        dropdown: 'var(--dropdown)',
        dropdownHover: 'var(--dropdown-hover)',
        buttonSecondary: 'var(--button-secondary)'
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)']
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out'
      }
    }
  },
  plugins: [require('tailwindcss-animate')]
} satisfies Config

export default config
