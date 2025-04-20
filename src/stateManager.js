export class StateManager {
    constructor(initialState = {}) {
        // Define default state structure with all possible options
        this.state = {
            bumpOptions: {
                sigma1: 1.0,
                sigma2: 2.0,
                heightScale: 1.0,
                bumpScale: 0.1,
                threshold: 0.1,
                ...initialState.bumpOptions
            },
            normalOptions: {
                strength: 1.0,
                normalScale: 1.0,
                ...initialState.normalOptions
            },
            albedoOptions: {
                brightness: 1.0,
                contrast: 1.0,
                saturation: 1.0,
                ...initialState.albedoOptions
            },
            emissionOptions: {
                threshold: 0.2,
                exponent: 1.0,
                blurRadius: 0,
                color: 0xaaaaaa,
                intensity: 1.0,
                ...initialState.emissionOptions
            },
            flags: {
                useNormalMap: true,
                useAlbedoMap: true,
                useEmissionMap: true,
                processingInProgress: false,
                pendingUpdate: false,
                ...initialState.flags
            },
            resources: {
                imageUrl: null,
                originalFileName: null,
                ...initialState.resources
            },
            textures: {
                bumpTexture: null,
                normalTexture: null,
                albedoTexture: null,
                emissionTexture: null,
                ...initialState.textures
            }
        };
        
        this.listeners = {};
        this.sectionListeners = {};  // For subscribing to specific sections
    }
    
    // Get a copy of current state or a section of it
    getState(section) {
        if (section) {
            return { ...this.state[section] };
        }
        return { ...this.state };
    }
    
    // Update state (partial updates supported)
    updateState(newState, silent = false) {
        let changes = [];
        
        // Process each section of state updates
        Object.keys(newState).forEach(section => {
            if (!this.state[section]) {
                // Create section if it doesn't exist
                this.state[section] = {};
            }
            
            if (typeof newState[section] === 'object' && !Array.isArray(newState[section])) {
                // Handle nested objects
                Object.keys(newState[section]).forEach(key => {
                    if (this.state[section][key] !== newState[section][key]) {
                        this.state[section][key] = newState[section][key];
                        changes.push({ section, key, value: newState[section][key] });
                    }
                });
            } else if (this.state[section] !== newState[section]) {
                // Handle direct value assignments
                this.state[section] = newState[section];
                changes.push({ section, value: newState[section] });
            }
        });
        
        // Notify listeners if changes occurred and not silenced
        if (!silent && changes.length > 0) {
            this.notifyListeners(changes);
        }
        
        return changes.length > 0;
    }
    
    // Reset a section or the entire state to default values
    resetState(section) {
        if (section) {
            // Reset only the specified section
            const defaultSection = this.constructor.getDefaultState()[section];
            if (defaultSection) {
                this.updateState({ [section]: defaultSection });
            }
        } else {
            // Reset entire state
            this.state = this.constructor.getDefaultState();
            this.notifyListeners([{ reset: true }]);
        }
    }
    
    // Get default state - static method to access default values
    static getDefaultState() {
        return {
            bumpOptions: {
                sigma1: 1.0,
                sigma2: 2.0,
                heightScale: 1.0,
                bumpScale: 0.1,
                threshold: 0.1
            },
            normalOptions: {
                strength: 1.0,
                normalScale: 1.0
            },
            albedoOptions: {
                brightness: 1.0,
                contrast: 1.0,
                saturation: 1.0
            },
            emissionOptions: {
                threshold: 0.2,
                exponent: 1.0,
                blurRadius: 0,
                color: 0xaaaaaa,
                intensity: 1.0
            },
            flags: {
                useNormalMap: true,
                useAlbedoMap: true,
                useEmissionMap: true,
                processingInProgress: false,
                pendingUpdate: false
            },
            resources: {
                imageUrl: null,
                originalFileName: null
            },
            textures: {
                bumpTexture: null,
                normalTexture: null,
                albedoTexture: null,
                emissionTexture: null
            }
        };
    }
    
    // Subscribe to all state changes
    subscribe(callback) {
        const id = `global_${Date.now().toString()}`;
        this.listeners[id] = callback;
        return id;
    }
    
    // Subscribe to changes in a specific section
    subscribeToSection(section, callback) {
        if (!this.sectionListeners[section]) {
            this.sectionListeners[section] = {};
        }
        const id = `${section}_${Date.now().toString()}`;
        this.sectionListeners[section][id] = callback;
        return id;
    }
    
    // Unsubscribe from state changes
    unsubscribe(id) {
        if (this.listeners[id]) {
            delete this.listeners[id];
            return true;
        }
        
        // Check section listeners
        for (const section in this.sectionListeners) {
            if (this.sectionListeners[section][id]) {
                delete this.sectionListeners[section][id];
                return true;
            }
        }
        
        return false;
    }
    
    // Notify all listeners of state changes
    notifyListeners(changes) {
        // First, notify global listeners
        Object.values(this.listeners).forEach(callback => {
            try {
                callback(changes, this.state);
            } catch (e) {
                console.error('Error in state change listener:', e);
            }
        });
        
        // Then notify section-specific listeners
        const affectedSections = [...new Set(changes.map(change => change.section))];
        affectedSections.forEach(section => {
            if (this.sectionListeners[section]) {
                Object.values(this.sectionListeners[section]).forEach(callback => {
                    try {
                        const sectionChanges = changes.filter(change => change.section === section);
                        callback(sectionChanges, this.state[section]);
                    } catch (e) {
                        console.error(`Error in section listener for ${section}:`, e);
                    }
                });
            }
        });
    }
    
    // Save state to localStorage
    saveToLocalStorage(key = 'textureMapperState') {
        try {
            // Create a serializable copy (remove non-serializable properties)
            const stateCopy = JSON.parse(JSON.stringify(this.state));
            
            // Remove textures and other non-serializable objects
            if (stateCopy.textures) {
                delete stateCopy.textures;
            }
            
            // Handle THREE.Color objects by converting to hex strings
            if (stateCopy.emissionOptions && typeof stateCopy.emissionOptions.color === 'number') {
                stateCopy.emissionOptions.color = stateCopy.emissionOptions.color;
            }
            
            localStorage.setItem(key, JSON.stringify(stateCopy));
            return true;
        } catch (e) {
            console.error('Failed to save state to localStorage:', e);
            return false;
        }
    }
    
    // Load state from localStorage
    loadFromLocalStorage(key = 'textureMapperState') {
        try {
            const saved = localStorage.getItem(key);
            if (saved) {
                const parsedState = JSON.parse(saved);
                this.updateState(parsedState);
                return true;
            }
            return false;
        } catch (e) {
            console.error('Failed to load state from localStorage:', e);
            return false;
        }
    }
}