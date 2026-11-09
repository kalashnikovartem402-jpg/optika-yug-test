module.exports = {
  content: ['./index.html', './js/content.js', './js/app.js', './admin/index.html', './admin/app.js'],
  theme: {
    extend: {
      fontFamily: { sans: ['"Inter"', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'] },
      colors: { slate: { 950: '#0B1120' } },
      animation: { 'pulse-dot': 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite', float: 'float 6s ease-in-out infinite' },
      keyframes: { float: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-8px)' } } },
    },
  },
};
