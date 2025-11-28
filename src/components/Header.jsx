import React from 'react';

export default function Header({ onOpenProfile, onLogout, onNavigateHome }) {
    return (
        <header className="bg-gray-gray100 dark:bg-gray-gray700 border-b border-gray-gray200 dark:border-gray-gray600">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    <div>
                        <button
                            type="button"
                            onClick={onNavigateHome}
                            className="text-xl font-semibold text-gray-gray800 dark:text-gray-gray100 hover:text-blue-blue dark:hover:text-blue-blue transition-colors cursor-pointer"
                        >
                            My Events
                        </button>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onOpenProfile}
                            className="px-4 py-2 bg-blue-blue text-white rounded-md hover:bg-opacity-90 transition-colors text-sm font-medium"
                        >
                            Profile
                        </button>
                        <button
                            type="button"
                            onClick={onLogout}
                            className="px-4 py-2 bg-gray-gray200 dark:bg-gray-gray600 text-gray-gray800 dark:text-gray-gray100 rounded-md hover:bg-gray-gray300 dark:hover:bg-gray-gray500 transition-colors text-sm font-medium"
                        >
                            Logout
                        </button>
                    </div>
                </div>
            </div>
        </header>
    );
}

