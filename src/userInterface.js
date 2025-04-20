import * as THREE from 'three';

export class UserInterface {
    constructor(stateManager, callbacks) {
        this.stateManager = stateManager;
        this.callbacks = callbacks || {};
        this.setupControls();
        this.updateImagePreview();
    }

    // File input handler
    handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            alert('Please select an image file');
            return;
        }
        
        const newImageUrl = URL.createObjectURL(file);
        console.log("Loading image from file:", file.name);
        
        // Revoke old blob URL if it exists
        const currentImageUrl = this.stateManager.getState('resources').imageUrl;
        if (typeof currentImageUrl === 'string' && currentImageUrl.startsWith('blob:')) {
            URL.revokeObjectURL(currentImageUrl);
        }
        
        // Update state with new image URL
        this.stateManager.updateState({
            resources: { imageUrl: newImageUrl }
        });
        
        this.updateImagePreview();
        if (this.callbacks.applyMaps) this.callbacks.applyMaps();
    }

    // Update preview div
    updateImagePreview() {
        const preview = document.getElementById('image-preview');
        const imageUrl = this.stateManager.getState('resources').imageUrl;
        
        if (preview && imageUrl) {
            preview.style.backgroundImage = `url(${imageUrl})`;
            preview.style.height = '100px';
            preview.style.backgroundSize = 'contain';
            preview.style.backgroundRepeat = 'no-repeat';
            preview.style.backgroundPosition = 'center';
            preview.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
            preview.style.border = '1px solid rgba(255, 255, 255, 0.3)';
            preview.style.marginTop = '10px';
        }
    }

    // Loading indicator
    showLoadingIndicator(show) {
        const loadingElement = document.getElementById('loading-indicator');
        if (!loadingElement) {
            if (show) {
                const loader = document.createElement('div');
                loader.id = 'loading-indicator';
                loader.style.position = 'fixed';
                loader.style.top = '10px';
                loader.style.right = '10px';
                loader.style.background = 'rgba(0,0,0,0.7)';
                loader.style.color = 'white';
                loader.style.padding = '8px 15px';
                loader.style.borderRadius = '4px';
                loader.style.zIndex = '1000';
                loader.textContent = 'Processing...';
                document.body.appendChild(loader);
            }
        } else {
            loadingElement.style.display = show ? 'block' : 'none';
        }
    }

    // Show error message
    showErrorMessage(message) {
        console.error(message);
        // Implement error display if needed
    }

    // Set up UI controls
    setupControls() {
        const state = this.stateManager.getState();
        
        // Bump controls
        const sigma1Slider       = document.getElementById('sigma1');
        const sigma2Slider       = document.getElementById('sigma2');
        const heightScaleSlider  = document.getElementById('heightScale');
        const bumpScaleSlider    = document.getElementById('bumpScale');
        const thresholdSlider    = document.getElementById('threshold');

        // Normal controls
        const strengthSlider     = document.getElementById('strength');
        const normalScaleSlider  = document.getElementById('normalScale');
        const useNormalMapCheckbox = document.getElementById('useNormalMap');

        // Albedo controls
        const brightnessSlider   = document.getElementById('brightness');
        const contrastSlider     = document.getElementById('contrast');
        const saturationSlider   = document.getElementById('saturation');
        const useAlbedoMapCheckbox = document.getElementById('useAlbedoMap');

        // Emission controls
        const emissionThresholdSlider = document.getElementById('emissionThreshold');
        const emissionExponentSlider = document.getElementById('emissionExponent');
        const emissionBlurSlider = document.getElementById('emissionBlur');
        const emissionColorPicker = document.getElementById('emissionColor');
        const emissionIntensitySlider = document.getElementById('emissionIntensity');
        const useEmissionMapCheckbox = document.getElementById('useEmissionMap');

        // Value displays
        const sigma1Value        = document.getElementById('sigma1Value');
        const sigma2Value        = document.getElementById('sigma2Value');
        const heightScaleValue   = document.getElementById('heightScaleValue');
        const bumpScaleValue     = document.getElementById('bumpScaleValue');
        const thresholdValue     = document.getElementById('thresholdValue');
        const strengthValue      = document.getElementById('strengthValue');
        const normalScaleValue   = document.getElementById('normalScaleValue');
        const brightnessValue    = document.getElementById('brightnessValue');
        const contrastValue      = document.getElementById('contrastValue');
        const saturationValue    = document.getElementById('saturationValue');
        const emissionThresholdValue = document.getElementById('emissionThresholdValue');
        const emissionExponentValue = document.getElementById('emissionExponentValue');
        const emissionBlurValue = document.getElementById('emissionBlurValue');
        const emissionIntensityValue = document.getElementById('emissionIntensityValue');

        function safeSetSliderValue(slider, valueDisplay, value) {
            if (slider && valueDisplay) {
                const v = parseFloat(value) || 0;
                slider.value = v;
                valueDisplay.textContent = v;
            }
        }

        // Set initial slider values from state
        safeSetSliderValue(sigma1Slider, sigma1Value, state.bumpOptions.sigma1);
        safeSetSliderValue(sigma2Slider, sigma2Value, state.bumpOptions.sigma2);
        safeSetSliderValue(heightScaleSlider, heightScaleValue, state.bumpOptions.heightScale);
        safeSetSliderValue(bumpScaleSlider, bumpScaleValue, state.bumpOptions.bumpScale);
        safeSetSliderValue(thresholdSlider, thresholdValue, state.bumpOptions.threshold);
        safeSetSliderValue(strengthSlider, strengthValue, state.normalOptions.strength);
        safeSetSliderValue(normalScaleSlider, normalScaleValue, state.normalOptions.normalScale);

        safeSetSliderValue(brightnessSlider, brightnessValue, state.albedoOptions.brightness);
        safeSetSliderValue(contrastSlider, contrastValue, state.albedoOptions.contrast);
        safeSetSliderValue(saturationSlider, saturationValue, state.albedoOptions.saturation);

        safeSetSliderValue(emissionThresholdSlider, emissionThresholdValue, state.emissionOptions.threshold);
        safeSetSliderValue(emissionExponentSlider, emissionExponentValue, state.emissionOptions.exponent);
        safeSetSliderValue(emissionBlurSlider, emissionBlurValue, state.emissionOptions.blurRadius);
        safeSetSliderValue(emissionIntensitySlider, emissionIntensityValue, state.emissionOptions.intensity);

        if (emissionColorPicker) {
            const colorHex = '#' + new THREE.Color(state.emissionOptions.color).getHexString();
            emissionColorPicker.value = colorHex;
        }

        if (useNormalMapCheckbox) useNormalMapCheckbox.checked = state.flags.useNormalMap;
        if (useAlbedoMapCheckbox) useAlbedoMapCheckbox.checked = state.flags.useAlbedoMap;
        if (useEmissionMapCheckbox) useEmissionMapCheckbox.checked = state.flags.useEmissionMap;

        const self = this;
        function createSliderListener(slider, valueDisplay, section, key, immediate = false) {
            if (!slider || !valueDisplay) return;
            slider.addEventListener('input', () => {
                const v = parseFloat(slider.value) || 0;
                valueDisplay.textContent = v;
                
                // Update state
                self.stateManager.updateState({
                    [section]: { [key]: v }
                });
                
                // Handle immediate effects
                if (immediate && key === 'normalScale' && self.callbacks.updateNormalScale) {
                    self.callbacks.updateNormalScale(v);
                }
                if (immediate && key === 'intensity' && self.callbacks.updateEmissiveIntensity) {
                    self.callbacks.updateEmissiveIntensity(v);
                }
            });
            
            slider.addEventListener('change', () => {
                if (!immediate && self.callbacks.debouncedApplyMaps) self.callbacks.debouncedApplyMaps();
            });
        }

        // Bump listeners
        createSliderListener(sigma1Slider, sigma1Value, 'bumpOptions', 'sigma1');
        createSliderListener(sigma2Slider, sigma2Value, 'bumpOptions', 'sigma2');
        createSliderListener(heightScaleSlider, heightScaleValue, 'bumpOptions', 'heightScale');
        createSliderListener(bumpScaleSlider, bumpScaleValue, 'bumpOptions', 'bumpScale');
        createSliderListener(thresholdSlider, thresholdValue, 'bumpOptions', 'threshold');

        // Normal listeners
        createSliderListener(strengthSlider, strengthValue, 'normalOptions', 'strength');
        createSliderListener(normalScaleSlider, normalScaleValue, 'normalOptions', 'normalScale', true);

        // Albedo listeners
        createSliderListener(brightnessSlider, brightnessValue, 'albedoOptions', 'brightness');
        createSliderListener(contrastSlider, contrastValue, 'albedoOptions', 'contrast');
        createSliderListener(saturationSlider, saturationValue, 'albedoOptions', 'saturation');

        // Emission listeners
        createSliderListener(emissionThresholdSlider, emissionThresholdValue, 'emissionOptions', 'threshold');
        createSliderListener(emissionExponentSlider, emissionExponentValue, 'emissionOptions', 'exponent');
        createSliderListener(emissionBlurSlider, emissionBlurValue, 'emissionOptions', 'blurRadius');
        createSliderListener(emissionIntensitySlider, emissionIntensityValue, 'emissionOptions', 'intensity', true);

        if (emissionColorPicker) {
            emissionColorPicker.addEventListener('input', () => {
                const color = new THREE.Color(emissionColorPicker.value).getHex();
                self.stateManager.updateState({
                    emissionOptions: { color }
                });
                
                if (self.callbacks.updateEmissiveColor) {
                    self.callbacks.updateEmissiveColor(new THREE.Color(emissionColorPicker.value));
                }
            });
            emissionColorPicker.addEventListener('change', () => {
                if (self.callbacks.debouncedApplyMaps) self.callbacks.debouncedApplyMaps();
            });
        }

        if (useNormalMapCheckbox) {
            useNormalMapCheckbox.addEventListener('change', () => {
                self.stateManager.updateState({
                    flags: { useNormalMap: useNormalMapCheckbox.checked }
                });
                
                if (self.callbacks.toggleNormalMap) {
                    self.callbacks.toggleNormalMap(useNormalMapCheckbox.checked);
                }
            });
        }
        
        if (useAlbedoMapCheckbox) {
            useAlbedoMapCheckbox.addEventListener('change', () => {
                self.stateManager.updateState({
                    flags: { useAlbedoMap: useAlbedoMapCheckbox.checked }
                });
                
                if (self.callbacks.toggleAlbedoMap) {
                    self.callbacks.toggleAlbedoMap(useAlbedoMapCheckbox.checked);
                }
            });
        }
        
        if (useEmissionMapCheckbox) {
            useEmissionMapCheckbox.addEventListener('change', () => {
                self.stateManager.updateState({
                    flags: { useEmissionMap: useEmissionMapCheckbox.checked }
                });
                
                if (self.callbacks.toggleEmissionMap) {
                    self.callbacks.toggleEmissionMap(useEmissionMapCheckbox.checked);
                }
            });
        }

        const applyButton = document.getElementById('applyChanges');
        if (applyButton) applyButton.addEventListener('click', () => {
            if (self.callbacks.applyMaps) self.callbacks.applyMaps();
        });

        const fileInput = document.getElementById('imageFile');
        if (fileInput) fileInput.addEventListener('change', this.handleFileSelect.bind(this));

        document.addEventListener('keydown', (event) => {
            if (event.ctrlKey && event.key === 'Enter') {
                if (self.callbacks.applyMaps) self.callbacks.applyMaps();
                event.preventDefault();
            }
        });
    }
}