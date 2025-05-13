// Enhanced Emission Mapping System
// This implementation generates sophisticated emission (glow) maps from images
// with multiple modes, channel selection, and advanced effects

import * as THREE from 'three';

/**
 * Enhanced class for generating emission maps with advanced options
 */
export class EmissionMapper {
    /**
     * @param {Object} options
     * @param {number} [options.threshold=0.5]      - Normalized threshold (0..1)
     * @param {number} [options.exponent=1.0]       - Exponent for falloff curve
     * @param {number} [options.blurRadius=0]       - Canvas blur radius in pixels
     * @param {string} [options.mode='luminance']   - Emission extraction mode: 'luminance', 'channel', 'color'
     * @param {string} [options.channel='rgb']      - Channel to use: 'r', 'g', 'b', 'a', 'rgb'
     * @param {string} [options.colorKey='ffffff']  - Color to key on in 'color' mode (hex without #)
     * @param {number} [options.colorTolerance=0.1] - Color match tolerance for 'color' mode (0..1)
     * @param {boolean} [options.invertMask=false]  - Invert the selection mask
     * @param {boolean} [options.preserveAlpha=true] - Keep original alpha channel
     */
    constructor(options = {}) {
        this.threshold      = options.threshold      !== undefined ? options.threshold      : 0.5;
        this.exponent       = options.exponent       !== undefined ? options.exponent       : 1.0;
        this.blurRadius     = options.blurRadius     !== undefined ? options.blurRadius     : 0;
        this.mode           = options.mode           !== undefined ? options.mode           : 'luminance';
        this.channel        = options.channel        !== undefined ? options.channel        : 'rgb';
        this.colorKey       = options.colorKey       !== undefined ? options.colorKey       : 'ffffff';
        this.colorTolerance = options.colorTolerance !== undefined ? options.colorTolerance : 0.1;
        this.invertMask     = options.invertMask     !== undefined ? options.invertMask     : false;
        this.preserveAlpha  = options.preserveAlpha  !== undefined ? options.preserveAlpha  : true;
    }

    /**
     * Main processing function
     * @param {ImageData} imageData - Input image data
     * @returns {ImageData} Generated emission map as ImageData
     */
    generateEmissionMap(imageData) {
        if (!imageData || !imageData.width || !imageData.height) {
            throw new Error('Invalid image data provided to EmissionMapper');
        }

        const width  = imageData.width;
        const height = imageData.height;
        const input  = imageData.data;
        const output = new ImageData(width, height);
        const outBuf = output.data;

        // Convert color key to RGB array if in color mode
        let keyColor = null;
        if (this.mode === 'color' && this.colorKey) {
            keyColor = this._hexToRgb(this.colorKey);
        }

        for (let i = 0; i < input.length; i += 4) {
            const r = input[i];
            const g = input[i + 1];
            const b = input[i + 2];
            const a = input[i + 3];

            // Calculate emission value based on selected mode
            let emissionValue = 0;
            
            switch (this.mode) {
                case 'luminance':
                    // Standard luminance calculation (weighted RGB)
                    emissionValue = this._calculateLuminance(r, g, b);
                    break;
                    
                case 'channel':
                    // Extract from specific channel(s)
                    emissionValue = this._extractFromChannel(r, g, b, a);
                    break;
                    
                case 'color':
                    // Calculate based on proximity to key color
                    emissionValue = this._colorProximity(r, g, b, keyColor);
                    break;
                    
                default:
                    emissionValue = this._calculateLuminance(r, g, b);
            }

            // Apply threshold
            let thresholdedValue = emissionValue <= this.threshold 
                ? 0 
                : (emissionValue - this.threshold) / (1 - this.threshold);
                
            // Option to invert mask
            if (this.invertMask) {
                thresholdedValue = 1 - thresholdedValue;
            }
            
            // Apply exponent for non-linear response
            const finalValue = Math.pow(thresholdedValue, this.exponent);
            
            // Pack back as grayscale value with original alpha
            const val = Math.min(255, Math.max(0, Math.floor(finalValue * 255)));
            outBuf[i]     = val;
            outBuf[i + 1] = val;
            outBuf[i + 2] = val;
            outBuf[i + 3] = this.preserveAlpha ? a : 255;
        }

        return output;
    }

    /**
     * Calculate standard luminance from RGB
     * @private
     */
    _calculateLuminance(r, g, b) {
        // Perceptual luminance weights (Rec. 709)
        return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    }

    /**
     * Extract value from specified channel(s)
     * @private
     */
    _extractFromChannel(r, g, b, a) {
        switch (this.channel) {
            case 'r': return r / 255;
            case 'g': return g / 255;
            case 'b': return b / 255;
            case 'a': return a / 255;
            case 'rgb': 
                // Average of RGB channels
                return (r + g + b) / (3 * 255);
            case 'max': 
                // Maximum channel value
                return Math.max(r, g, b) / 255;
            default:
                return (r + g + b) / (3 * 255);
        }
    }

    /**
     * Calculate proximity to key color
     * @private
     */
    _colorProximity(r, g, b, keyColor) {
        if (!keyColor) return 0;
        
        // Calculate color distance in RGB space (normalized)
        const dr = Math.abs(r - keyColor[0]) / 255;
        const dg = Math.abs(g - keyColor[1]) / 255;
        const db = Math.abs(b - keyColor[2]) / 255;
        
        // Euclidean distance in RGB space (normalized 0-1)
        const distance = Math.sqrt(dr*dr + dg*dg + db*db) / Math.sqrt(3);
        
        // Convert distance to proximity (1 = exact match, 0 = far away)
        const proximity = 1 - Math.min(1, distance / this.colorTolerance);
        
        return proximity;
    }

    /**
     * Convert hex string to RGB array
     * @private
     */
    _hexToRgb(hex) {
        // Remove # if present
        hex = hex.replace(/^#/, '');
        
        // Parse hex to RGB
        const bigint = parseInt(hex, 16);
        const r = (bigint >> 16) & 255;
        const g = (bigint >> 8) & 255;
        const b = bigint & 255;
        
        return [r, g, b];
    }
}

/**
 * Enhanced Three.js integration for Emission Mapping
 */
export class ThreeJsEmissionMapper {
    /**
     * @param {Object} options
     * @param {number}  [options.threshold]
     * @param {number}  [options.exponent]
     * @param {number}  [options.blurRadius]
     * @param {string}  [options.mode]              - Emission mode: 'luminance', 'channel', 'color'
     * @param {string}  [options.channel]           - Channel to use in 'channel' mode
     * @param {string}  [options.colorKey]          - Target color in 'color' mode
     * @param {number}  [options.colorTolerance]    - Color matching tolerance
     * @param {boolean} [options.invertMask]        - Invert selection mask
     * @param {boolean} [options.preserveAlpha]     - Keep original alpha
     * @param {string|number} [options.color]       - Emission color as hex string or 0xrrggbb
     * @param {number}  [options.intensity=1.0]     - Emissive intensity multiplier
     * @param {boolean} [options.showPreviews=true]
     * @param {number}  [options.previewSize=128]
     * @param {boolean} [options.debugLogs=false]
     * @param {string}  [options.previewElementId]  - ID of <canvas> for embedded preview
     */
    constructor(options = {}) {
        // Core mapper with enhanced options
        this.mapper = new EmissionMapper({
            threshold:      options.threshold,
            exponent:       options.exponent,
            blurRadius:     options.blurRadius,
            mode:           options.mode,
            channel:        options.channel,
            colorKey:       options.colorKey,
            colorTolerance: options.colorTolerance,
            invertMask:     options.invertMask,
            preserveAlpha:  options.preserveAlpha
        });
        
        // rendering & preview options
        this.options = {
            showPreviews:     options.showPreviews !== false,
            previewSize:      options.previewSize  || 128,
            debugLogs:        options.debugLogs    || false,
            previewElementId: options.previewElementId || null
        };
        this._previewElements = [];
        
        // output color & intensity
        this.color     = options.color !== undefined ? new THREE.Color(options.color) : new THREE.Color(0xffffff);
        this.intensity = options.intensity !== undefined ? options.intensity : 1.0;
    }

    /**
     * Process an image URL and create a THREE.Texture for emissiveMap
     * @param {string} imageUrl
     * @returns {Promise<THREE.Texture>}
     */
    createEmissionTexture(imageUrl) {
        return new Promise((resolve, reject) => {
            this._cleanupPreviews();
            const img = new Image();

            // ONLY set crossOrigin for *network* URLs, not blob URLs
            if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
                img.crossOrigin = 'Anonymous';
            }

            img.onload = () => {
                try {
                    // draw source
                    const srcCanvas = document.createElement('canvas');
                    const srcCtx    = srcCanvas.getContext('2d');
                    srcCanvas.width  = img.width;
                    srcCanvas.height = img.height;
                    srcCtx.drawImage(img, 0, 0);

                    // compute emission map with enhanced options
                    const srcData = srcCtx.getImageData(0, 0, img.width, img.height);
                    const outData = this.mapper.generateEmissionMap(srcData);

                    // draw to output canvas
                    let outCanvas = document.createElement('canvas');
                    outCanvas.width  = outData.width;
                    outCanvas.height = outData.height;
                    const outCtx = outCanvas.getContext('2d');
                    outCtx.putImageData(outData, 0, 0);

                    // optional blur
                    if (this.mapper.blurRadius > 0) {
                        const blurCanvas = document.createElement('canvas');
                        blurCanvas.width  = outCanvas.width;
                        blurCanvas.height = outCanvas.height;
                        const blurCtx = blurCanvas.getContext('2d');
                        blurCtx.filter = `blur(${this.mapper.blurRadius}px)`;
                        blurCtx.drawImage(outCanvas, 0, 0);
                        outCanvas = blurCanvas;
                    }

                    // optional floating previews
                    if (this.options.showPreviews && !this.options.previewElementId) {
                        this._createPreviews(outCanvas);
                    }
                    
                    // embedded preview
                    if (this.options.previewElementId) {
                        const preview = document.getElementById(this.options.previewElementId);
                        if (preview && preview.getContext) {
                            preview.width  = outCanvas.width;
                            preview.height = outCanvas.height;
                            const ctx = preview.getContext('2d');
                            ctx.clearRect(0, 0, preview.width, preview.height);
                            ctx.drawImage(outCanvas, 0, 0, preview.width, preview.height);
                        }
                    }

                    // apply color tinting
                    const tintedCanvas = document.createElement('canvas');
                    tintedCanvas.width  = outCanvas.width;
                    tintedCanvas.height = outCanvas.height;
                    const tintedCtx = tintedCanvas.getContext('2d');
                    
                    // draw grayscale as alpha mask
                    tintedCtx.drawImage(outCanvas, 0, 0);
                    tintedCtx.globalCompositeOperation = 'source-in';
                    tintedCtx.fillStyle = `#${this.color.getHexString()}`;
                    tintedCtx.fillRect(0, 0, tintedCanvas.width, tintedCanvas.height);

                    // create texture
                    const texture = new THREE.Texture(tintedCanvas);
                    texture.wrapS = THREE.RepeatWrapping;
                    texture.wrapT = THREE.RepeatWrapping;
                    texture.needsUpdate = true;

                    if (this.options.debugLogs) {
                        console.log('[EmissionMap] generated', {
                            size: `${outCanvas.width}×${outCanvas.height}`,
                            threshold: this.mapper.threshold,
                            exponent: this.mapper.exponent,
                            blurRadius: this.mapper.blurRadius,
                            mode: this.mapper.mode,
                            channel: this.mapper.channel,
                            color: this.color.getHexString()
                        });
                    }

                    resolve(texture);
                } catch (err) {
                    console.error('[EmissionMap] Error generating emission map:', err);
                    reject(err);
                }
            };
            
            img.onerror = (err) => {
                console.error('[EmissionMap] Image load failed:', err);
                reject(new Error(`Failed to load image: ${imageUrl}`));
            };
            
            img.src = imageUrl;
        });
    }

    /**
     * Display floating preview canvases
     * @private
     */
    _createPreviews(canvas) {
        const size   = this.options.previewSize;
        const cvPrev = canvas.cloneNode(true);
        cvPrev.className = 'emission-preview';
        cvPrev.style.cssText = `
            position: fixed;
            top: 10px;
            right: ${10 + this._previewElements.length * (size + 10)}px;
            width: ${size}px;
            height: ${size}px;
            border: 2px solid #fff;
            z-index: 9999;
        `;
        document.body.appendChild(cvPrev);
        this._previewElements.push(cvPrev);
    }

    /**
     * Remove previews
     * @private
     */
    _cleanupPreviews() {
        this._previewElements.forEach(el => el.parentNode?.removeChild(el));
        this._previewElements = [];
    }

    /**
     * Static helper to apply emission map to a mesh
     * @param {THREE.Mesh} mesh
     * @param {string} imageUrl
     * @param {Object} options
     * @returns {Promise<THREE.Texture>}
     */
    static async applyToMesh(mesh, imageUrl, options = {}) {
        if (!mesh) throw new Error('[EmissionMap] Invalid mesh provided');
        const mapper = new ThreeJsEmissionMapper(options);
        try {
            if (mesh.material && mesh.material.emissiveMap) {
                mesh.material.emissiveMap.dispose();
            }
            const tex = await mapper.createEmissionTexture(imageUrl);
            if (mesh.material) {
                mesh.material.emissiveMap       = tex;
                mesh.material.emissive.copy(mapper.color);
                mesh.material.emissiveIntensity = mapper.intensity;
                mesh.material.needsUpdate       = true;
            }
            return tex;
        } finally {
            mapper._cleanupPreviews();
        }
    }
}