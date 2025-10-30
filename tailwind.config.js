/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,jsx,ts,tsx}"
    ],
    theme: {
        extend: {
            colors: {
                // Mirror custom palette names used in the extension
                'blue-blue': '#3b82f6',
                'green-green': '#16a34a',
                'red-red': '#ef4444',
                'yellow-yellow': '#eab308',
                'gray-gray50': '#f9fafb',
                'gray-gray100': '#f3f4f6',
                'gray-gray200': '#e5e7eb',
                'gray-gray300': '#d1d5db',
                'gray-gray400': '#9ca3af',
                'gray-gray500': '#6b7280',
                'gray-gray600': '#4b5563',
                'gray-gray700': '#374151',
                'gray-gray800': '#1f2937',
                'gray-gray900': '#111827'
            }
        }
    },
    darkMode: 'media'
};


