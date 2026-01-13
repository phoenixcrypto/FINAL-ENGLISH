/**
 * Progress Tracker - Separate progress tracking per language mode
 * Stores progress in localStorage with mode-specific keys
 */

class ProgressTracker {
    constructor() {
        this.STORAGE_PREFIX = 'it_english_progress_';
        this.langSystem = window.LanguageSystem;
    }

    /**
     * Get progress key for current mode
     */
    getProgressKey() {
        const mode = this.langSystem ? this.langSystem.getMode() : 'exam';
        return `${this.STORAGE_PREFIX}${mode}`;
    }

    /**
     * Get progress for a specific mode
     */
    getProgress(mode = null) {
        const key = mode ? `${this.STORAGE_PREFIX}${mode}` : this.getProgressKey();
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : this.getDefaultProgress();
        } catch (error) {
            console.error('ProgressTracker: Failed to load progress:', error);
            return this.getDefaultProgress();
        }
    }

    /**
     * Save progress for current mode
     */
    saveProgress(progress) {
        const key = this.getProgressKey();
        try {
            localStorage.setItem(key, JSON.stringify({
                ...progress,
                lastUpdated: Date.now(),
                mode: this.langSystem ? this.langSystem.getMode() : 'exam'
            }));
            return true;
        } catch (error) {
            console.error('ProgressTracker: Failed to save progress:', error);
            return false;
        }
    }

    /**
     * Update progress for a specific section
     */
    updateSectionProgress(section, data) {
        const progress = this.getProgress();
        
        if (!progress.sections) {
            progress.sections = {};
        }

        progress.sections[section] = {
            ...progress.sections[section],
            ...data,
            lastUpdated: Date.now()
        };

        return this.saveProgress(progress);
    }

    /**
     * Get section progress
     */
    getSectionProgress(section) {
        const progress = this.getProgress();
        return progress.sections && progress.sections[section] 
            ? progress.sections[section] 
            : null;
    }

    /**
     * Update exam results
     */
    saveExamResults(results) {
        const progress = this.getProgress();
        progress.examResults = results;
        progress.lastExamDate = Date.now();
        return this.saveProgress(progress);
    }

    /**
     * Get exam results
     */
    getExamResults() {
        const progress = this.getProgress();
        return progress.examResults || null;
    }

    /**
     * Get all progress across all modes
     */
    getAllProgress() {
        const modes = ['exam', 'study', 'beginner'];
        const allProgress = {};

        modes.forEach(mode => {
            allProgress[mode] = this.getProgress(mode);
        });

        return allProgress;
    }

    /**
     * Clear progress for current mode
     */
    clearProgress() {
        const key = this.getProgressKey();
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.error('ProgressTracker: Failed to clear progress:', error);
            return false;
        }
    }

    /**
     * Clear all progress
     */
    clearAllProgress() {
        const modes = ['exam', 'study', 'beginner'];
        let success = true;

        modes.forEach(mode => {
            const key = `${this.STORAGE_PREFIX}${mode}`;
            try {
                localStorage.removeItem(key);
            } catch (error) {
                console.error(`ProgressTracker: Failed to clear progress for ${mode}:`, error);
                success = false;
            }
        });

        return success;
    }

    /**
     * Get default progress structure
     */
    getDefaultProgress() {
        return {
            sections: {},
            examResults: null,
            lastExamDate: null,
            totalTimeSpent: 0,
            completedSections: [],
            createdAt: Date.now(),
            lastUpdated: Date.now()
        };
    }

    /**
     * Get statistics
     */
    getStats() {
        const progress = this.getProgress();
        const stats = {
            totalSections: Object.keys(progress.sections || {}).length,
            completedSections: progress.completedSections || [],
            totalTimeSpent: progress.totalTimeSpent || 0,
            lastExamDate: progress.lastExamDate,
            hasExamResults: !!progress.examResults
        };

        return stats;
    }

    /**
     * Compare progress across modes
     */
    compareModes() {
        const allProgress = this.getAllProgress();
        const comparison = {
            exam: this.getStatsForMode('exam', allProgress.exam),
            study: this.getStatsForMode('study', allProgress.study),
            beginner: this.getStatsForMode('beginner', allProgress.beginner)
        };

        return comparison;
    }

    /**
     * Get stats for a specific mode
     */
    getStatsForMode(mode, progress) {
        if (!progress) {
            progress = this.getProgress(mode);
        }

        return {
            sectionsCompleted: (progress.completedSections || []).length,
            totalTimeSpent: progress.totalTimeSpent || 0,
            lastActivity: progress.lastUpdated,
            hasExamResults: !!progress.examResults
        };
    }
}

// Create and export singleton instance
const progressTracker = new ProgressTracker();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = progressTracker;
}

// Make available globally
if (typeof window !== 'undefined') {
    window.ProgressTracker = progressTracker;
}

