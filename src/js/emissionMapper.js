// Emission Mapping System
// This implementation generates an emission (glow) map from images by thresholding,
// exponential falloff, optional blur, and color tinting.

import * as THREE from 'three';

/**
 * Class for generating an emission map by thresholding, exponentiation, and blur
 */
export class EmissionMapper {
    /**
     * @param {Object} options
     * @param {number} [options.threshold=0.5]  - Normalized threshold (0..1)
     * @param {number} [options.exponent=1.0]   - Exponent for falloff curve
     * @param {number} [options.blurRadius=0]   - Canvas blur radius in pixels
     */
    constructor(options = {}) {
        this.threshold  = options.threshold  !== undefined ? options.threshold  : 0.5;
        this.exponent   = options.exponent   !== undefined ? options.exponent   : 1.0;
        this.blurRadius = options.blurRadius !== undefined ? options.blurRadius : 0;
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

        for (let i = 0; i < input.length; i += 4) {
            const r = input[i];
            const g = input[i + 1];
            const b = input[i + 2];
            const a = input[i + 3];

            // luminance normalized
            const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
            // threshold ramp
            const raw = lum <= this.threshold
                ? 0
                : (lum - this.threshold) / (1 - this.threshold);
            // exponentiate
            const e = Math.pow(raw, this.exponent);

            // pack back, preserving alpha
            const val = Math.min(255, Math.max(0, Math.floor(e * 255)));
            outBuf[i]     = val;
            outBuf[i + 1] = val;
            outBuf[i + 2] = val;
            outBuf[i + 3] = a;
        }

        return output;
    }
}

/**
 * Three.js integration for Emission Mapping
 */
export class ThreeJsEmissionMapper {
    /**
     * @param {Object} options
     * @param {number}  [options.threshold]
     * @param {number}  [options.exponent]
     * @param {number}  [options.blurRadius]
     * @param {string}  [options.color]            - Hex color string or 0xrrggbb
     * @param {number}  [options.intensity=1.0]    - Emissive intensity multiplier
     * @param {boolean} [options.showPreviews=true]
     * @param {number}  [options.previewSize=128]
     * @param {boolean} [options.debugLogs=false]
     * @param {string}  [options.previewElementId] - ID of <canvas> for embedded preview
     */
    constructor(options = {}) {
        // core mapper
        this.mapper = new EmissionMapper({
            threshold:  options.threshold,
            exponent:   options.exponent,
            blurRadius: options.blurRadius
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
            img.crossOrigin = 'Anonymous';

            img.onload = () => {
                try {
                    // draw source
                    const srcCanvas = document.createElement('canvas');
                    const srcCtx    = srcCanvas.getContext('2d');
                    srcCanvas.width  = img.width;
                    srcCanvas.height = img.height;
                    srcCtx.drawImage(img, 0, 0);

                    // compute raw emission map
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

                    // tint output canvas by applying color and alpha mask
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
                    texture.wrapS     = THREE.RepeatWrapping;
                    texture.wrapT     = THREE.RepeatWrapping;
                    texture.needsUpdate = true;

                    if (this.options.debugLogs) {
                        console.log('[EmissionMap] generated', {
                            size: `${outCanvas.width}×${outCanvas.height}`,
                            threshold: this.mapper.threshold,
                            exponent: this.mapper.exponent,
                            blurRadius: this.mapper.blurRadius
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
        const mapper    = new ThreeJsEmissionMapper(options);
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
 