/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                aviation: {
                    dark: '#0f172a',
                    card: '#1e293b',
                    accent: '#38bdf8',
                    success: '#22c55e',
                    danger: '#ef4444',
                    warning: '#eab308',
                }
            }
        },
    },
    plugins: [],
}
