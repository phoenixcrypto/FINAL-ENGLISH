/**
 * Language Integration - Connects LanguageSystem and ContentLibrary with UI
 * Handles dynamic content updates, language switcher, and tooltips
 */

class LanguageIntegration {
    constructor() {
        this.langSystem = window.LanguageSystem;
        this.contentLib = window.ContentLibrary;
        this.translations = {};
        this.initialized = false;
    }

    /**
     * Initialize language integration
     */
    async init() {
        if (this.initialized) {
            return;
        }

        try {
            // Check if language system and content library exist
            if (!this.langSystem || !this.contentLib) {
                console.warn('LanguageIntegration: LanguageSystem or ContentLibrary not available');
                return;
            }

            // Wait for language system to be ready
            await this.langSystem.init();
            await this.contentLib.init();

            // Load UI translations
            await this.loadTranslations();

            // Set up language switcher
            this.setupLanguageSwitcher();

            // Subscribe to language system changes
            this.langSystem.subscribe((state) => {
                this.handleLanguageChange(state);
            });

            // Initial content update
            await this.updateAllContent();

            this.initialized = true;
        } catch (error) {
            console.error('LanguageIntegration: Initialization error:', error);
        }
    }

    /**
     * Load UI translations
     */
    async loadTranslations() {
        try {
            this.translations = await this.contentLib.loadTranslations('ui');
        } catch (error) {
            console.warn('LanguageIntegration: Could not load UI translations:', error);
            this.translations = {};
        }
    }

    /**
     * Setup language switcher component
     */
    setupLanguageSwitcher() {
        try {
            const switcherBtn = document.getElementById('langSwitcherBtn');
            const dropdown = document.getElementById('langSwitcherDropdown');

            if (!switcherBtn || !dropdown) {
                // Language switcher not present on this page - that's okay
                return;
            }

            const modeOptions = dropdown.querySelectorAll('.lang-mode-option');

            if (!this.langSystem) {
                console.warn('LanguageIntegration: LanguageSystem not available');
                return;
            }

            // Update current mode display
            this.updateModeDisplay();

            // Toggle dropdown
            switcherBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                dropdown.classList.toggle('active');
                switcherBtn.setAttribute('aria-expanded', dropdown.classList.contains('active'));
            });

            // Close dropdown when clicking outside
            document.addEventListener('click', (e) => {
                if (switcherBtn && dropdown && 
                    !switcherBtn.contains(e.target) && !dropdown.contains(e.target)) {
                    dropdown.classList.remove('active');
                    switcherBtn.setAttribute('aria-expanded', 'false');
                }
            });

            // Handle mode selection
            modeOptions.forEach(option => {
                option.addEventListener('click', async () => {
                    try {
                        const mode = option.dataset.mode;
                        if (!mode || !this.langSystem) {
                            return;
                        }
                        
                        await this.langSystem.setMode(mode);
                        
                        // Update active state
                        modeOptions.forEach(opt => opt.classList.remove('active'));
                        option.classList.add('active');
                        
                        // Close dropdown
                        dropdown.classList.remove('active');
                        switcherBtn.setAttribute('aria-expanded', 'false');
                    } catch (error) {
                        console.error('LanguageIntegration: Error switching mode:', error);
                    }
                });
            });

            // Keyboard navigation
            switcherBtn.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    switcherBtn.click();
                }
            });

            modeOptions.forEach((option, index) => {
                option.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        option.click();
                    } else if (e.key === 'ArrowDown' && index < modeOptions.length - 1) {
                        e.preventDefault();
                        modeOptions[index + 1].focus();
                    } else if (e.key === 'ArrowUp' && index > 0) {
                        e.preventDefault();
                        modeOptions[index - 1].focus();
                    }
                });
            });
        } catch (error) {
            console.error('LanguageIntegration: Error setting up language switcher:', error);
        }
    }

    /**
     * Update mode display in switcher
     */
    updateModeDisplay() {
        try {
            if (!this.langSystem) {
                return;
            }

            const display = document.getElementById('currentModeDisplay');
            if (display) {
                display.textContent = this.langSystem.getModeDisplayName();
            }

            // Update active option
            const dropdown = document.getElementById('langSwitcherDropdown');
            if (dropdown) {
                const options = dropdown.querySelectorAll('.lang-mode-option');
                const currentMode = this.langSystem.getMode();
                options.forEach(opt => {
                    if (opt.dataset.mode === currentMode) {
                        opt.classList.add('active');
                    } else {
                        opt.classList.remove('active');
                    }
                });
            }
        } catch (error) {
            console.error('LanguageIntegration: Error updating mode display:', error);
        }
    }

    /**
     * Handle language system changes
     */
    async handleLanguageChange(state) {
        try {
            // Update mode display
            this.updateModeDisplay();

            // Update all content
            await this.updateAllContent();

            // Update tooltips if in study mode
            if (state && state.shouldShowArabicHelp) {
                this.setupTooltips();
            } else {
                this.removeTooltips();
            }
        } catch (error) {
            console.error('LanguageIntegration: Error handling language change:', error);
        }
    }

    /**
     * Update all content on the page
     */
    async updateAllContent() {
        try {
            if (!this.langSystem) {
                return;
            }

            const mode = this.langSystem.getMode();
            const elements = document.querySelectorAll('[data-i18n]');

            for (const element of elements) {
                const key = element.getAttribute('data-i18n');
                if (key) {
                    await this.updateElement(element, key, mode);
                }
            }
        } catch (error) {
            console.error('LanguageIntegration: Error updating all content:', error);
        }
    }

    /**
     * Update a single element with translated content
     */
    async updateElement(element, key, mode) {
        try {
            const content = await this.contentLib.getContent(key, null, mode);
            const textElement = element.querySelector('.i18n-text') || element;

            if (mode === 'exam') {
                // Exam mode: English only
                const englishText = this.getEnglishText(key);
                if (textElement === element) {
                    element.textContent = englishText;
                } else {
                    textElement.textContent = englishText;
                }
            } else if (mode === 'study') {
                // Study mode: English with Arabic available
                const englishText = this.getEnglishText(key);
                if (textElement === element) {
                    element.textContent = englishText;
                } else {
                    textElement.textContent = englishText;
                }
                // Add help indicator
                this.addHelpIndicator(element, content.help);
            } else if (mode === 'beginner') {
                // Beginner mode: Bilingual
                const arabicText = content.main || this.getArabicText(key);
                const englishText = content.english || this.getEnglishText(key);

                if (textElement === element) {
                    element.innerHTML = `
                        <span class="arabic-text">${arabicText}</span>
                        <span class="english-text">${englishText}</span>
                    `;
                } else {
                    textElement.innerHTML = `
                        <span class="arabic-text">${arabicText}</span>
                        <span class="english-text">${englishText}</span>
                    `;
                }
            }
        } catch (error) {
            console.warn(`LanguageIntegration: Failed to update element ${key}:`, error);
        }
    }

    /**
     * Get English text for a key
     */
    getEnglishText(key) {
        // Try to get from translations
        const translation = this.getNestedValue(this.translations, key);
        if (translation) {
            return translation;
        }

        // Fallback: return key or existing text
        return this.getDefaultText(key);
    }

    /**
     * Get Arabic text for a key
     */
    getArabicText(key) {
        const translation = this.getNestedValue(this.translations, key);
        return translation || this.getDefaultText(key);
    }

    /**
     * Get default text (fallback)
     */
    getDefaultText(key) {
        // Try to get from element's current text
        const element = document.querySelector(`[data-i18n="${key}"]`);
        if (element) {
            const textEl = element.querySelector('.i18n-text');
            return textEl ? textEl.textContent : element.textContent;
        }
        return key;
    }

    /**
     * Get nested value from object using dot notation
     */
    getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => {
            return current && current[key] !== undefined ? current[key] : null;
        }, obj);
    }

    /**
     * Add help indicator for study mode
     */
    addHelpIndicator(element, helpText) {
        try {
            if (!element || !helpText || !this.langSystem || !this.langSystem.shouldShowArabicHelp()) {
                return;
            }

            // Remove existing indicator
            const existing = element.querySelector('.help-indicator');
            if (existing) {
                existing.remove();
            }

            // Add tooltip container
            if (!element.classList.contains('tooltip-container')) {
                element.classList.add('tooltip-container');
            }

            // Add help indicator
            const indicator = document.createElement('span');
            indicator.className = 'help-indicator';
            indicator.textContent = '?';
            indicator.setAttribute('aria-label', 'Arabic help available');
            
            // Add tooltip content
            const tooltip = document.createElement('span');
            tooltip.className = 'tooltip-content';
            tooltip.textContent = helpText;
            tooltip.setAttribute('role', 'tooltip');

            element.appendChild(indicator);
            element.appendChild(tooltip);
        } catch (error) {
            console.error('LanguageIntegration: Error adding help indicator:', error);
        }
    }

    /**
     * Setup tooltips for study mode
     */
    setupTooltips() {
        const tooltipContainers = document.querySelectorAll('.tooltip-container');
        tooltipContainers.forEach(container => {
            container.addEventListener('click', (e) => {
                e.stopPropagation();
                container.classList.toggle('active');
            });
        });
    }

    /**
     * Remove tooltips
     */
    removeTooltips() {
        const indicators = document.querySelectorAll('.help-indicator');
        indicators.forEach(ind => ind.remove());
        
        const tooltips = document.querySelectorAll('.tooltip-content');
        tooltips.forEach(tt => tt.remove());
    }
}

// Initialize when DOM is ready
const languageIntegration = new LanguageIntegration();

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        languageIntegration.init();
    });
} else {
    languageIntegration.init();
}

// Export
if (typeof window !== 'undefined') {
    window.LanguageIntegration = languageIntegration;
}

