import * as THREE from 'three';

// UserInterface manages the dynamic sidebar controls: map-type selection, parameter panels, file upload, apply/download actions.
export class UserInterface {
  constructor(stateManager, callbacks) {
    this.stateManager = stateManager;
    this.callbacks = callbacks || {};

    // Initialize UI elements and bind handlers
    this.setupControls();
    this.updateImagePreview();
  }

  /**
   * Helper: enable/disable and label the Download button based on current textures
   * @param {string} type - one of 'bump','normal','albedo','emission'
   */
  updateDownloadButton(type) {
    const btn = document.getElementById('download-current');
    const hasTexture = !!this.stateManager.getState().textures[type + 'Texture'];
    btn.disabled = !hasTexture;
    btn.textContent = `Download ${type.charAt(0).toUpperCase() + type.slice(1)} Map`;
  }  

/**
   * Handles image file selection: updates state and preview, then re-applies current map.
   */
handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }
    
    // Read file as Data URL instead of creating a blob URL
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = /** @type {string} */ (reader.result);
      console.log("Loading image from file (data URL):", file.name);

      // Update state with Data URL and original filename
      this.stateManager.updateState({
        resources: { imageUrl: dataUrl, originalFileName: file.name }
      });

      this.updateImagePreview();
      // Trigger reprocessing with the current map type
      const type = this.currentMapType;
      if (this.callbacks.applyMaps) this.callbacks.applyMaps(type);
    };
    reader.onerror = (error) => {
      console.error("Failed to read file as Data URL:", error);
      this.showErrorMessage(`Failed to load image file: ${file.name}`);
    };
    reader.readAsDataURL(file);
  }

  /**
   * Updates the image preview thumbnail.
   */
  updateImagePreview() {
    const preview = document.getElementById('image-preview');
    const url = this.stateManager.getState().resources.imageUrl;
    if (preview) preview.style.backgroundImage = url ? `url(${url})` : '';
  }

  /**
   * Delegates to the callback for showing/hiding loading spinner.
   */
  showLoadingIndicator(show) {
    if (this.callbacks.showLoadingIndicator) {
      this.callbacks.showLoadingIndicator(show);
    }
  }

  /**
   * Delegates error display to callback or console.
   */
  showErrorMessage(msg) {
    if (this.callbacks.showErrorMessage) {
      this.callbacks.showErrorMessage(msg);
    } else {
      console.error(msg);
    }
  }

  /**
   * Downloads the currently selected map texture.
   */
  downloadCurrent() {
    const key = this.currentMapType + 'Texture';
    const tex = this.stateManager.getState().textures[key];
    if (!tex) {
      this.showErrorMessage(`No ${this.currentMapType} map available`);
      return;
    }
    const orig = this.stateManager.getState().resources.originalFileName || 'texture';
    const base = orig.split('.')[0];
    const filename = `${base}_${this.currentMapType}.png`;
    this.textureToImage(tex, filename);
  }

  /**
   * Renders a texture to a hidden canvas and triggers a download.
   */
  textureToImage(texture, fileName) {
    const canvas = document.createElement('canvas');
    const renderer = new THREE.WebGLRenderer({ canvas, preserveDrawingBuffer: true });
    const w = texture.image?.width || 1024;
    const h = texture.image?.height || 1024;
    renderer.setSize(w, h);
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0.1, 10);
    camera.position.z = 1;
    const material = new THREE.MeshBasicMaterial({ map: texture });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
    scene.add(plane);
    renderer.render(scene, camera);

    const dataURL = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = dataURL;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    renderer.dispose();
    material.dispose();
  }

  /**
   * Creates a color picker input element and returns the container
   * @private
   */
  _createColorPicker(id, label, value, onChange) {
    const wrapper = document.createElement('div');
    wrapper.classList.add('control', 'color-control');
    
    const lbl = document.createElement('label');
    lbl.htmlFor = id;
    lbl.textContent = label;
    wrapper.appendChild(lbl);
    
    const input = document.createElement('input');
    input.type = 'color';
    input.id = id;
    
    // Convert number color value to hex string for input
    const colorValue = '#' + (new THREE.Color(value).getHexString());
    input.value = colorValue;
    
    input.addEventListener('change', () => {
      // Remove # and convert to number for Three.js
      const colorHex = parseInt(input.value.replace('#', ''), 16);
      onChange(colorHex);
    });
    
    wrapper.appendChild(input);
    return wrapper;
  }
  
  /**
   * Creates a dropdown select element
   * @private
   */
  _createDropdown(id, label, options, value, onChange) {
    const wrapper = document.createElement('div');
    wrapper.classList.add('control');
    
    const lbl = document.createElement('label');
    lbl.htmlFor = id;
    lbl.textContent = label;
    wrapper.appendChild(lbl);
    
    const select = document.createElement('select');
    select.id = id;
    
    options.forEach(option => {
      const opt = document.createElement('option');
      opt.value = option.value;
      opt.textContent = option.label;
      select.appendChild(opt);
    });
    
    select.value = value;
    select.addEventListener('change', () => {
      onChange(select.value);
    });
    
    wrapper.appendChild(select);
    return wrapper;
  }

  /**
   * Builds the parameter controls for the selected map type.
   */
  renderParameterPanel(type, container) {
    this.currentMapType = type;
    container.innerHTML = '';
    const state = this.stateManager.getState();

    // Helper to create label+input+value span
    const makeControl = ({ label, id, min, max, step, value, checkbox, flagKey }) => {
      const wrapper = document.createElement('div');
      wrapper.classList.add('control');

      const lbl = document.createElement('label');
      lbl.htmlFor = id;
      lbl.textContent = label;
      wrapper.appendChild(lbl);

      const input = document.createElement('input');
      input.id = id;
      if (checkbox) {
        input.type = 'checkbox';
        input.checked = value;
      } else {
        input.type = 'range';
        Object.assign(input, { min, max, step, value });
      }
      wrapper.appendChild(input);

      const span = document.createElement('span');
      span.id = id + 'Value';
      span.textContent = checkbox ? '' : value;
      wrapper.appendChild(span);

      return { wrapper, input, span };
    };

    // Map-type specific configs
    let configs = [];
    if (type === 'bump') {
      configs = [
        { label: 'σ₁',         id: 'sigma1',      min:'0.1', max:'10', step:'0.1', value: state.bumpOptions.sigma1 },
        { label: 'σ₂',         id: 'sigma2',      min:'0.1', max:'10', step:'0.1', value: state.bumpOptions.sigma2 },
        { label: 'Height',     id: 'heightScale', min:'0.1', max:'5',  step:'0.1', value: state.bumpOptions.heightScale },
        { label: 'Bump',       id: 'bumpScale',   min:'0',   max:'1',  step:'0.01',value: state.bumpOptions.bumpScale },
        { label: 'Threshold',  id: 'threshold',   min:'0',   max:'1',  step:'0.01',value: state.bumpOptions.threshold }
      ];
    } else if (type === 'normal') {
      configs = [
        { label: 'Strength',    id: 'strength',    min:'0.1', max:'5',  step:'0.1', value: state.normalOptions.strength },
        { label: 'NormalScale', id: 'normalScale', min:'0',   max:'3',  step:'0.1', value: state.normalOptions.normalScale }
      ];
    } else if (type === 'albedo') {
      configs = [
        { label: 'Brightness',  id: 'brightness',  min:'0',   max:'2',  step:'0.1', value: state.albedoOptions.brightness },
        { label: 'Contrast',    id: 'contrast',    min:'0',   max:'2',  step:'0.1', value: state.albedoOptions.contrast },
        { label: 'Saturation',  id: 'saturation',  min:'0',   max:'2',  step:'0.1', value: state.albedoOptions.saturation }
      ];
    } else if (type === 'emission') {
      // Basic emission slider controls (keeping these from the original implementation)
      configs = [
        { label: 'Threshold',       id: 'emissionThreshold', min:'0',  max:'1',  step:'0.01', value: state.emissionOptions.threshold },
        { label: 'Exponent',        id: 'emissionExponent',  min:'0.1',max:'5',  step:'0.1',  value: state.emissionOptions.exponent },
        { label: 'Blur Radius',     id: 'emissionBlur',      min:'0',  max:'50', step:'1',    value: state.emissionOptions.blurRadius },
        { label: 'Intensity',       id: 'emissionIntensity', min:'0',  max:'5',  step:'0.1',  value: state.emissionOptions.intensity },
      ];
      
      // Insert controls and wire up events for slider controls first
      configs.forEach(cfg => {
        const { wrapper, input, span } = makeControl(cfg);
        container.appendChild(wrapper);

        if (input.type === 'range') {
          input.addEventListener('input', () => {
            span.textContent = input.value;
            // Map UI ID to state option key
            const optionKey = cfg.id.replace('emission', '').toLowerCase();
            this.stateManager.updateState({ 
              emissionOptions: { [optionKey]: parseFloat(input.value) }
            });
          });
          input.addEventListener('change', () => {
            if (this.callbacks.debouncedApplyMaps) this.callbacks.debouncedApplyMaps(type);
          });
        }
      });
      
      // Now add the advanced emission options (dropdowns, color picker, checkboxes)
      
      // 1. Mode selection dropdown
      const modeDropdown = this._createDropdown('emissionMode', 'Mode', [
        { value: 'luminance', label: 'Luminance' },
        { value: 'channel', label: 'Channel' },
        { value: 'color', label: 'Color Key' }
      ], state.emissionOptions.mode, (value) => {
        this.stateManager.updateState({ emissionOptions: { mode: value }});
        // Update UI elements visibility based on mode
        this._updateEmissionControlsVisibility(container, value);
        if (this.callbacks.debouncedApplyMaps) this.callbacks.debouncedApplyMaps(type);
      });
      container.appendChild(modeDropdown);
      
      // 2. Channel selection (visible when mode is 'channel')
      const channelDropdown = this._createDropdown('emissionChannel', 'Channel', [
        { value: 'r', label: 'Red' },
        { value: 'g', label: 'Green' },
        { value: 'b', label: 'Blue' },
        { value: 'a', label: 'Alpha' },
        { value: 'rgb', label: 'RGB Average' },
        { value: 'max', label: 'Maximum RGB' }
      ], state.emissionOptions.channel, (value) => {
        this.stateManager.updateState({ emissionOptions: { channel: value }});
        if (this.callbacks.debouncedApplyMaps) this.callbacks.debouncedApplyMaps(type);
      });
      channelDropdown.id = 'channelDropdownControl';
      channelDropdown.style.display = state.emissionOptions.mode === 'channel' ? 'block' : 'none';
      container.appendChild(channelDropdown);
      
      // 3. Color Key controls (visible when mode is 'color')
      const colorKeyWrapper = document.createElement('div');
      colorKeyWrapper.id = 'colorKeyControls';
      colorKeyWrapper.style.display = state.emissionOptions.mode === 'color' ? 'block' : 'none';
      
      // 3a. Color key picker
      const colorKeyPicker = this._createColorPicker('emissionColorKey', 'Key Color', 
        parseInt(state.emissionOptions.colorKey, 16), (colorHex) => {
          const colorKeyHex = colorHex.toString(16).padStart(6, '0');
          this.stateManager.updateState({ emissionOptions: { colorKey: colorKeyHex }});
          if (this.callbacks.debouncedApplyMaps) this.callbacks.debouncedApplyMaps(type);
      });
      colorKeyWrapper.appendChild(colorKeyPicker);
      
      // 3b. Color tolerance slider
      const { wrapper: toleranceWrapper, input: toleranceInput, span: toleranceSpan } = makeControl({
        label: 'Color Tolerance', 
        id: 'colorTolerance',
        min: '0.01',
        max: '1',
        step: '0.01',
        value: state.emissionOptions.colorTolerance
      });
      
      toleranceInput.addEventListener('input', () => {
        toleranceSpan.textContent = toleranceInput.value;
        this.stateManager.updateState({ 
          emissionOptions: { colorTolerance: parseFloat(toleranceInput.value) }
        });
      });
      
      toleranceInput.addEventListener('change', () => {
        if (this.callbacks.debouncedApplyMaps) this.callbacks.debouncedApplyMaps(type);
      });
      
      colorKeyWrapper.appendChild(toleranceWrapper);
      container.appendChild(colorKeyWrapper);
      
      // 4. Emission glow color picker
      const emissionColorPicker = this._createColorPicker('emissionColor', 'Glow Color', 
        state.emissionOptions.color, (colorHex) => {
          this.stateManager.updateState({ emissionOptions: { color: colorHex }});
          if (this.callbacks.debouncedApplyMaps) this.callbacks.debouncedApplyMaps(type);
      });
      container.appendChild(emissionColorPicker);
      
      // 5. Additional checkbox options
      const invertMaskControl = makeControl({
        label: 'Invert Mask',
        id: 'invertMask',
        checkbox: true,
        value: state.emissionOptions.invertMask
      });
      
      invertMaskControl.input.addEventListener('change', () => {
        this.stateManager.updateState({ 
          emissionOptions: { invertMask: invertMaskControl.input.checked }
        });
        if (this.callbacks.debouncedApplyMaps) this.callbacks.debouncedApplyMaps(type);
      });
      
      container.appendChild(invertMaskControl.wrapper);
      
      const preserveAlphaControl = makeControl({
        label: 'Preserve Alpha',
        id: 'preserveAlpha',
        checkbox: true,
        value: state.emissionOptions.preserveAlpha
      });
      
      preserveAlphaControl.input.addEventListener('change', () => {
        this.stateManager.updateState({ 
          emissionOptions: { preserveAlpha: preserveAlphaControl.input.checked }
        });
        if (this.callbacks.debouncedApplyMaps) this.callbacks.debouncedApplyMaps(type);
      });
      
      container.appendChild(preserveAlphaControl.wrapper);
      
      // 6. Finally, add the "Use Emission Map" checkbox from the original code
      const useEmissionMapControl = makeControl({
        label: 'Use Emission Map',
        id: 'useEmissionMap',
        checkbox: true,
        value: state.flags.useEmissionMap,
        flagKey: 'useEmissionMap'
      });
      
      useEmissionMapControl.input.addEventListener('change', () => {
        this.stateManager.updateState({ 
          flags: { useEmissionMap: useEmissionMapControl.input.checked }
        });
        if (this.callbacks.toggleEmissionMap) {
          this.callbacks.toggleEmissionMap(useEmissionMapControl.input.checked);
        }
      });
      
      container.appendChild(useEmissionMapControl.wrapper);
      
      // No need to append configs in this case since we've handled them specially
      return;
    }

    // Insert controls and wire up events for non-emission types
    configs.forEach(cfg => {
      const { wrapper, input, span } = makeControl(cfg);
      container.appendChild(wrapper);

      if (input.type === 'range') {
        input.addEventListener('input', () => {
          span.textContent = input.value;
          this.stateManager.updateState({ [`${type}Options`]: { [cfg.id]: parseFloat(input.value) } });
        });
        input.addEventListener('change', () => {
          if (this.callbacks.debouncedApplyMaps) this.callbacks.debouncedApplyMaps(type);
        });
      }
      if (input.type === 'checkbox') {
        input.addEventListener('change', () => {
          this.stateManager.updateState({ flags: { [cfg.flagKey]: input.checked } });
          if (this.callbacks.toggleEmissionMap && cfg.flagKey === 'useEmissionMap') {
            this.callbacks.toggleEmissionMap(input.checked);
          }
        });
      }
    });
  }

  /**
   * Shows/hides emission controls based on the selected mode
   * @private
   */
  _updateEmissionControlsVisibility(container, mode) {
    // Channel dropdown visibility
    const channelControl = container.querySelector('#channelDropdownControl');
    if (channelControl) {
      channelControl.style.display = mode === 'channel' ? 'block' : 'none';
    }
    
    // Color key controls visibility
    const colorKeyControls = container.querySelector('#colorKeyControls');
    if (colorKeyControls) {
      colorKeyControls.style.display = mode === 'color' ? 'block' : 'none';
    }
  }

  /**
   * Sets up top-level UI bindings: map-type selector, apply/download buttons, file input.
   */
  setupControls() {
    const mapType = document.getElementById('mapType');
    const panel = document.getElementById('parameter-panel');
    const fileInput = document.getElementById('imageFile');
    const applyBtn = document.getElementById('applyChanges');
    const downloadBtn = document.getElementById('download-current');

    // When user selects map type, rebuild controls & update download button
    mapType.addEventListener('change', () => {
        const type = mapType.value;
        this.renderParameterPanel(type, panel);
        downloadBtn.textContent = `Download ${type.charAt(0).toUpperCase() + type.slice(1)}
 Map`;
        downloadBtn.disabled   = !this.stateManager.getState().textures[type + 'Texture'];
        // If you want to re‐run on change:
        // this.callbacks.applyMaps(type);
      });
      

    // Apply triggers map-specific processing
    applyBtn.addEventListener('click', () => {
        const type = mapType.value;        // <-- extract the string
        this.callbacks.applyMaps(type);
      });
      

    // Download invokes our downloadCurrent method
    downloadBtn.addEventListener('click', () => this.downloadCurrent());

    // File input binding
    fileInput.addEventListener('change', this.handleFileSelect.bind(this));

    // Initial rendering on startup
    this.renderParameterPanel(mapType.value, panel);
    downloadBtn.textContent = `Download ${mapType.value.charAt(0).toUpperCase() + mapType.value.slice(1)} Map`;
    downloadBtn.disabled = !this.stateManager.getState().textures[mapType.value + 'Texture'];
  }
}