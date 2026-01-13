/**
 * Content Library - Dynamic Content Loader with Caching
 * 
 * Features:
 * - Lazy loading of translation files
 * - LRU cache for frequently used content (500+ terms)
 * - Support for nested JSON structures
 * - Context-aware translations
 * - Technical term explanations (bilingual)
 * - Version control for content updates
 * - Batch loading for performance
 */

class ContentLibrary {
    constructor() {
        // Singleton pattern
        if (ContentLibrary.instance) {
            return ContentLibrary.instance;
        }

        // Cache configuration
        this.CACHE_SIZE = 500; // Maximum cached items
        this.CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

        // Cache storage (LRU implementation)
        this.cache = new Map();
        this.cacheTimestamps = new Map();

        // Loaded translation files
        this.loadedTranslations = {
            ui: null,
            content: null,
            explanations: null
        };

        // Loading promises (prevent duplicate requests)
        this.loadingPromises = {};

        // Base paths
        this.TRANSLATION_PATH = 'ar-help/';
        this.DATA_PATH = 'data/';

        // Set singleton instance
        ContentLibrary.instance = this;
    }

    /**
     * Initialize content library
     * Pre-loads essential translations if needed
     */
    async init() {
        // Pre-load UI translations for faster initial render
        try {
            await this.loadTranslations('ui');
        } catch (error) {
            console.warn('ContentLibrary: Could not pre-load UI translations:', error);
        }
    }

    /**
     * Get content based on current language mode
     * @param {string} key - Content key (supports dot notation: 'ui.nav.home')
     * @param {string} context - Optional context for context-aware translations
     * @param {string} mode - Optional mode override
     * @returns {Promise<any>}
     */
    async getContent(key, context = null, mode = null) {
        // Get current mode from LanguageSystem if not provided
        if (!mode && typeof window !== 'undefined' && window.LanguageSystem) {
            mode = window.LanguageSystem.getMode();
        } else if (!mode) {
            mode = 'exam'; // Default fallback
        }

        // Check cache first
        const cacheKey = this.getCacheKey(key, context, mode);
        const cached = this.getFromCache(cacheKey);
        if (cached !== null) {
            return cached;
        }

        // Load content based on mode
        let content;
        switch (mode) {
            case 'exam':
                content = await this.getEnglishContent(key, context);
                break;
            case 'study':
                content = await this.getStudyContent(key, context);
                break;
            case 'beginner':
                content = await this.getBeginnerContent(key, context);
                break;
            default:
                content = await this.getEnglishContent(key, context);
        }

        // Cache the result
        this.addToCache(cacheKey, content);

        return content;
    }

    /**
     * Get English-only content (Exam mode)
     * @param {string} key - Content key
     * @param {string} context - Optional context
     * @returns {Promise<any>}
     */
    async getEnglishContent(key, context = null) {
        // For exam mode, return English content only
        // Try to get from existing data files first
        const dataContent = await this.getFromDataFiles(key, context);
        if (dataContent) {
            return dataContent;
        }

        // Fallback: return key as-is (English is default)
        return {
            text: key,
            mode: 'exam',
            isEnglish: true
        };
    }

    /**
     * Get study mode content (English + Arabic help)
     * @param {string} key - Content key
     * @param {string} context - Optional context
     * @returns {Promise<any>}
     */
    async getStudyContent(key, context = null) {
        const english = await this.getEnglishContent(key, context);
        const arabic = await this.getArabicTranslation(key, context);

        return {
            main: english,
            help: arabic,
            mode: 'study',
            showHelp: true
        };
    }

    /**
     * Get beginner mode content (Bilingual - Arabic primary)
     * @param {string} key - Content key
     * @param {string} context - Optional context
     * @returns {Promise<any>}
     */
    async getBeginnerContent(key, context = null) {
        const english = await this.getEnglishContent(key, context);
        const arabic = await this.getArabicTranslation(key, context);

        return {
            main: arabic || english, // Arabic primary, fallback to English
            english: english,
            mode: 'beginner',
            isBilingual: true
        };
    }

    /**
     * Get Arabic translation
     * @param {string} key - Content key
     * @param {string} context - Optional context
     * @returns {Promise<string|null>}
     */
    async getArabicTranslation(key, context = null) {
        // Load translations if not already loaded
        await this.loadTranslations('content');

        // Get translation with context awareness
        const translation = this.findTranslation(key, context, this.loadedTranslations.content);
        
        if (translation) {
            return translation;
        }

        // Try UI translations
        await this.loadTranslations('ui');
        const uiTranslation = this.findTranslation(key, context, this.loadedTranslations.ui);
        
        return uiTranslation || null;
    }

    /**
     * Find translation in loaded data (supports dot notation and context)
     * @param {string} key - Content key
     * @param {string} context - Optional context
     * @param {Object} data - Translation data object
     * @returns {any|null}
     */
    findTranslation(key, context, data) {
        if (!data) {
            return null;
        }

        // Support dot notation: 'ui.nav.home'
        const keys = key.split('.');
        let current = data;

        for (const k of keys) {
            if (current && typeof current === 'object' && k in current) {
                current = current[k];
            } else {
                return null;
            }
        }

        // Context-aware translation
        if (context && typeof current === 'object' && context in current) {
            return current[context];
        }

        // Return direct value or object
        if (typeof current === 'string' || typeof current === 'object') {
            return current;
        }

        return null;
    }

    /**
     * Get content from existing data files
     * @param {string} key - Content key
     * @param {string} context - Optional context
     * @returns {Promise<any>}
     */
    async getFromDataFiles(key, context = null) {
        // Map keys to data files
        const fileMap = {
            'technical-terms': 'technical-terms.json',
            'synonyms': 'synonyms.json',
            'reading': 'reading-texts.json',
            'grammar': 'grammar-exercises.json'
        };

        // Try to determine which file based on key
        let fileName = null;
        for (const [prefix, file] of Object.entries(fileMap)) {
            if (key.startsWith(prefix) || key.includes(prefix)) {
                fileName = file;
                break;
            }
        }

        if (!fileName) {
            return null;
        }

        try {
            const data = await this.loadJSONFile(`${this.DATA_PATH}${fileName}`);
            
            // Extract relevant content based on key structure
            // This is a simplified version - can be enhanced based on actual data structure
            if (data.terms && Array.isArray(data.terms)) {
                // Technical terms
                const term = data.terms.find(t => 
                    t.term === key || t.term.toLowerCase().includes(key.toLowerCase())
                );
                if (term) {
                    return {
                        term: term.term,
                        definition: term.definition,
                        example: term.example,
                        synonyms: term.synonyms || []
                    };
                }
            }

            if (data.synonyms && Array.isArray(data.synonyms)) {
                // Synonyms
                const synonym = data.synonyms.find(s => 
                    s.term === key || s.term.toLowerCase().includes(key.toLowerCase())
                );
                if (synonym) {
                    return {
                        term: synonym.term,
                        synonyms: synonym.synonyms,
                        definition: synonym.definition,
                        example: synonym.example
                    };
                }
            }

            return null;
        } catch (error) {
            console.warn(`ContentLibrary: Could not load from data file ${fileName}:`, error);
            return null;
        }
    }

    /**
     * Load translation files
     * @param {string} type - 'ui', 'content', or 'explanations'
     * @returns {Promise<Object>}
     */
    async loadTranslations(type) {
        // Check if already loaded
        if (this.loadedTranslations[type]) {
            return this.loadedTranslations[type];
        }

        // Check if already loading (prevent duplicate requests)
        if (this.loadingPromises[type]) {
            return this.loadingPromises[type];
        }

        // Start loading
        const fileName = this.getTranslationFileName(type);
        const promise = this.loadJSONFile(`${this.TRANSLATION_PATH}${fileName}`)
            .then(data => {
                this.loadedTranslations[type] = data;
                delete this.loadingPromises[type];
                return data;
            })
            .catch(error => {
                console.warn(`ContentLibrary: Could not load ${type} translations:`, error);
                delete this.loadingPromises[type];
                // Return empty object as fallback
                this.loadedTranslations[type] = {};
                return {};
            });

        this.loadingPromises[type] = promise;
        return promise;
    }

    /**
     * Get translation file name
     * @param {string} type - Translation type
     * @returns {string}
     */
    getTranslationFileName(type) {
        const fileMap = {
            'ui': 'ui-translations.json',
            'content': 'content-translations.json',
            'explanations': 'explanations.json'
        };
        return fileMap[type] || `${type}-translations.json`;
    }

    /**
     * Load JSON file (with caching)
     * @param {string} path - File path
     * @returns {Promise<Object>}
     */
    async loadJSONFile(path) {
        try {
            const response = await fetch(path);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return await response.json();
        } catch (error) {
            console.error(`ContentLibrary: Failed to load ${path}:`, error);
            throw error;
        }
    }

    /**
     * Get explanation for a term (bilingual)
     * @param {string} term - Technical term
     * @returns {Promise<Object>}
     */
    async getExplanation(term) {
        // Load explanations if not loaded
        await this.loadTranslations('explanations');

        const explanations = this.loadedTranslations.explanations;
        if (!explanations) {
            return null;
        }

        // Find explanation (case-insensitive)
        const termLower = term.toLowerCase();
        for (const [key, value] of Object.entries(explanations)) {
            if (key.toLowerCase() === termLower) {
                return value;
            }
        }

        return null;
    }

    /**
     * Batch load multiple content items
     * @param {Array<string>} keys - Array of content keys
     * @param {string} mode - Language mode
     * @returns {Promise<Object>}
     */
    async batchLoad(keys, mode = null) {
        const promises = keys.map(key => this.getContent(key, null, mode));
        const results = await Promise.all(promises);
        
        const batch = {};
        keys.forEach((key, index) => {
            batch[key] = results[index];
        });

        return batch;
    }

    /**
     * Cache management methods
     */
    getCacheKey(key, context, mode) {
        return `${mode}:${key}:${context || 'default'}`;
    }

    getFromCache(cacheKey) {
        const cached = this.cache.get(cacheKey);
        if (!cached) {
            return null;
        }

        // Check TTL
        const timestamp = this.cacheTimestamps.get(cacheKey);
        if (timestamp && Date.now() - timestamp > this.CACHE_TTL) {
            this.cache.delete(cacheKey);
            this.cacheTimestamps.delete(cacheKey);
            return null;
        }

        return cached;
    }

    addToCache(cacheKey, content) {
        // LRU: Remove oldest if cache is full
        if (this.cache.size >= this.CACHE_SIZE) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
            this.cacheTimestamps.delete(firstKey);
        }

        this.cache.set(cacheKey, content);
        this.cacheTimestamps.set(cacheKey, Date.now());
    }

    clearCache() {
        this.cache.clear();
        this.cacheTimestamps.clear();
    }

    /**
     * Get cache statistics (for debugging)
     * @returns {Object}
     */
    getCacheStats() {
        return {
            size: this.cache.size,
            maxSize: this.CACHE_SIZE,
            loadedTranslations: Object.keys(this.loadedTranslations).filter(
                key => this.loadedTranslations[key] !== null
            )
        };
    }
}

// Create and export singleton instance
// ... existing code ...

    /**
     * Batch load multiple content items
     * @param {Array<string>} keys - Array of content keys
     * @param {string} mode - Language mode
     * @returns {Promise<Object>}
     */
    async batchLoad(keys, mode = null) {
        const promises = keys.map(key => this.getContent(key, null, mode));
        const results = await Promise.all(promises);
        
        const batch = {};
        keys.forEach((key, index) => {
            batch[key] = results[index];
        });

        return batch;
    }

    /**
     * Cache management methods
     */
    getCacheKey(key, context, mode) {
        return `${mode}:${key}:${context || 'default'}`;
    }

    getFromCache(cacheKey) {
        const cached = this.cache.get(cacheKey);
        if (!cached) {
            return null;
        }

        // Check TTL
        const timestamp = this.cacheTimestamps.get(cacheKey);
        if (timestamp && Date.now() - timestamp > this.CACHE_TTL) {
            this.cache.delete(cacheKey);
            this.cacheTimestamps.delete(cacheKey);
            return null;
        }

        return cached;
    }

    addToCache(cacheKey, content) {
        // LRU: Remove oldest if cache is full
        if (this.cache.size >= this.CACHE_SIZE) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
            this.cacheTimestamps.delete(firstKey);
        }

        this.cache.set(cacheKey, content);
        this.cacheTimestamps.set(cacheKey, Date.now());
    }

    clearCache() {
        this.cache.clear();
        this.cacheTimestamps.clear();
    }

    /**
     * Get cache statistics (for debugging)
     * @returns {Object}
     */
    getCacheStats() {
        return {
            size: this.cache.size,
            maxSize: this.CACHE_SIZE,
            loadedTranslations: Object.keys(this.loadedTranslations).filter(
                key => this.loadedTranslations[key] !== null
            )
        };
    }
}

// Auto-initialize when DOM is ready
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            contentLibrary.init();
        });
    } else {
        contentLibrary.init();
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = contentLibrary;
}

// Make available globally
// أضف إنشاء الـ Singleton والربط بالنافذة/الوحدة
const contentLibrary = new ContentLibrary();
if (typeof window !== 'undefined') {
    window.ContentLibrary = contentLibrary;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = contentLibrary;
}

