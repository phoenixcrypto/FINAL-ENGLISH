/**
 * Language System - Production-Ready Bilingual System
 * Supports 3 modes: Exam (English only), Study (English + Arabic help), Beginner (Bilingual)
 * 
 * Features:
 * - Singleton pattern for global access
 * - Observer pattern for real-time updates
 * - localStorage persistence
 * - RTL/LTR dynamic switching
 * - Performance optimized (<50ms mode switch)
 */

class LanguageSystem {
    constructor() {
        // Singleton pattern - ensure only one instance
        if (LanguageSystem.instance) {
            return LanguageSystem.instance;
        }

        // Configuration
        this.VERSION = '1.0.0';
        this.STORAGE_KEY = 'it_english_lang_system';
        this.MODES = {
            EXAM: 'exam',
            STUDY: 'study',
            BEGINNER: 'beginner'
        };

        // State
        this.mode = this.MODES.EXAM; // Default mode
        this.dir = 'ltr'; // Default direction
        this.observers = []; // Observer pattern subscribers
        this.contentCache = {}; // Cache for loaded content
        this.initialized = false;

        // Direction mapping per mode
        this.modeDirections = {
            [this.MODES.EXAM]: 'ltr',
            [this.MODES.STUDY]: 'ltr',
            [this.MODES.BEGINNER]: 'rtl'
        };

        // Set singleton instance
        LanguageSystem.instance = this;
    }

    /**
     * Initialize the language system
     * Loads preferences from localStorage and sets up the system
     */
    async init() {
        if (this.initialized) {
            return this;
        }

        try {
            // Load saved preferences
            const saved = this.loadPreferences();
            if (saved) {
                this.mode = saved.mode || this.MODES.EXAM;
                this.dir = saved.dir || this.modeDirections[this.mode];
            } else {
                // Default initialization
                this.mode = this.MODES.EXAM;
                this.dir = this.modeDirections[this.mode];
            }

            // Apply initial settings
            this.applyDirection();
            this.applyModeClass();

            // Mark as initialized
            this.initialized = true;

            // Notify observers
            this.notifyObservers();

            return this;
        } catch (error) {
            console.error('LanguageSystem initialization error:', error);
            // Fallback to defaults
            this.mode = this.MODES.EXAM;
            this.dir = 'ltr';
            this.initialized = true;
            return this;
        }
    }

    /**
     * Set the language mode
     * @param {string} mode - 'exam', 'study', or 'beginner'
     * @returns {Promise<void>}
     */
    async setMode(mode) {
        if (!Object.values(this.MODES).includes(mode)) {
            console.warn(`Invalid mode: ${mode}. Using default: ${this.MODES.EXAM}`);
            mode = this.MODES.EXAM;
        }

        // Performance: Check if mode is actually changing
        if (this.mode === mode) {
            return;
        }

        const startTime = performance.now();

        // Update mode
        this.mode = mode;
        this.dir = this.modeDirections[mode];

        // Apply changes
        this.applyDirection();
        this.applyModeClass();

        // Save preferences
        this.savePreferences();

        // Notify observers
        this.notifyObservers();

        // Performance check
        const duration = performance.now() - startTime;
        if (duration > 50) {
            console.warn(`Mode switch took ${duration.toFixed(2)}ms (target: <50ms)`);
        }

        return Promise.resolve();
    }

    /**
     * Get current mode
     * @returns {string}
     */
    getMode() {
        return this.mode;
    }

    /**
     * Get current direction (ltr/rtl)
     * @returns {string}
     */
    getDirection() {
        return this.dir;
    }

    /**
     * Get content based on current mode
     * This is a wrapper that will be used with ContentLibrary
     * @param {string} key - Content key
     * @param {string} context - Optional context for context-aware translations
     * @returns {any}
     */
    getContent(key, context = null) {
        // This will be enhanced by ContentLibrary
        // For now, return a structure that indicates what mode we're in
        return {
            mode: this.mode,
            key: key,
            context: context,
            needsTranslation: this.mode !== this.MODES.EXAM
        };
    }

    /**
     * Check if Arabic help should be shown
     * @returns {boolean}
     */
    shouldShowArabicHelp() {
        return this.mode === this.MODES.STUDY || this.mode === this.MODES.BEGINNER;
    }

    /**
     * Check if interface should be bilingual
     * @returns {boolean}
     */
    isBilingual() {
        return this.mode === this.MODES.BEGINNER;
    }

    /**
     * Check if in exam mode (pure English)
     * @returns {boolean}
     */
    isExamMode() {
        return this.mode === this.MODES.EXAM;
    }

    /**
     * Subscribe to language system changes (Observer pattern)
     * @param {Function} callback - Function to call when mode changes
     * @returns {Function} Unsubscribe function
     */
    subscribe(callback) {
        if (typeof callback !== 'function') {
            console.warn('LanguageSystem.subscribe: callback must be a function');
            return () => {};
        }

        this.observers.push(callback);

        // Return unsubscribe function
        return () => {
            const index = this.observers.indexOf(callback);
            if (index > -1) {
                this.observers.splice(index, 1);
            }
        };
    }

    /**
     * Notify all observers of changes
     */
    notifyObservers() {
        const state = {
            mode: this.mode,
            dir: this.dir,
            isExamMode: this.isExamMode(),
            shouldShowArabicHelp: this.shouldShowArabicHelp(),
            isBilingual: this.isBilingual()
        };

        this.observers.forEach(callback => {
            try {
                callback(state);
            } catch (error) {
                console.error('LanguageSystem observer error:', error);
            }
        });
    }

    /**
     * Apply RTL/LTR direction to document
     */
    applyDirection() {
        if (typeof document === 'undefined') {
            return;
        }

        const html = document.documentElement;
        html.setAttribute('dir', this.dir);
        html.setAttribute('lang', this.dir === 'rtl' ? 'ar' : 'en');

        // Update body class for CSS targeting
        document.body.classList.remove('dir-ltr', 'dir-rtl');
        document.body.classList.add(`dir-${this.dir}`);
    }

    /**
     * Apply mode-specific CSS class
     */
    applyModeClass() {
        if (typeof document === 'undefined') {
            return;
        }

        const body = document.body;
        body.classList.remove('mode-exam', 'mode-study', 'mode-beginner');
        body.classList.add(`mode-${this.mode}`);
    }

    /**
     * Save preferences to localStorage
     */
    savePreferences() {
        try {
            const data = {
                version: this.VERSION,
                mode: this.mode,
                dir: this.dir,
                timestamp: Date.now()
            };
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
        } catch (error) {
            console.error('LanguageSystem: Failed to save preferences:', error);
        }
    }

    /**
     * Load preferences from localStorage
     * @returns {Object|null}
     */
    loadPreferences() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            if (!data) {
                return null;
            }

            const parsed = JSON.parse(data);
            
            // Version check - if version mismatch, reset to defaults
            if (parsed.version !== this.VERSION) {
                console.info('LanguageSystem: Version mismatch, resetting preferences');
                return null;
            }

            return parsed;
        } catch (error) {
            console.error('LanguageSystem: Failed to load preferences:', error);
            return null;
        }
    }

    /**
     * Reset to defaults
     */
    reset() {
        this.mode = this.MODES.EXAM;
        this.dir = this.modeDirections[this.mode];
        this.savePreferences();
        this.applyDirection();
        this.applyModeClass();
        this.notifyObservers();
    }

    /**
     * Get mode display name (for UI)
     * @param {string} mode - Optional mode, uses current if not provided
     * @returns {string}
     */
    getModeDisplayName(mode = null) {
        const targetMode = mode || this.mode;
        const names = {
            [this.MODES.EXAM]: 'Exam Mode',
            [this.MODES.STUDY]: 'Study Mode',
            [this.MODES.BEGINNER]: 'Beginner Mode'
        };
        return names[targetMode] || targetMode;
    }

    /**
     * Get mode description (for UI)
     * @param {string} mode - Optional mode, uses current if not provided
     * @returns {string}
     */
    getModeDescription(mode = null) {
        const targetMode = mode || this.mode;
        const descriptions = {
            [this.MODES.EXAM]: 'Pure English - Real exam simulation',
            [this.MODES.STUDY]: 'English with Arabic help tooltips',
            [this.MODES.BEGINNER]: 'Bilingual interface - Arabic primary'
        };
        return descriptions[targetMode] || '';
    }
}

// Create and export singleton instance
const languageSystem = new LanguageSystem();

// Auto-initialize when DOM is ready (if in browser environment)
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            languageSystem.init();
        });
    } else {
        languageSystem.init();
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = languageSystem;
}

// Make available globally
if (typeof window !== 'undefined') {
    window.LanguageSystem = languageSystem;
}
