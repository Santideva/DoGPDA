// Albedo Mapping System
// This implementation adjusts brightness, contrast, and saturation to generate an albedo (diffuse) map from images

/**
 * Class for generating an albedo map by adjusting image properties
 */
export class AlbedoMapper {
    /**
     * @param {Object} options
     * @param {number} [options.brightness=1.0] - Scale factor for brightness (1 = no change)
     * @param {number} [options.contrast=1.0]   - Contrast factor (1 = no change)
     * @param {number} [options.saturation=1.0] - Saturation factor (1 = no change)
     */
    constructor(options = {}) {
        this.brightness = options.brightness !== undefined ? options.brightness : 1.0;
        this.contrast   = options.contrast   !== undefined ? options.contrast   : 1.0;
        this.saturation = options.saturation !== undefined ? options.saturation : 1.0;
    }

    /**
     * Main processing function
     * @param {ImageData} imageData - Input image data
     * @returns {ImageData} Generated albedo map as ImageData
     */
    generateAlbedoMap(imageData) {
        if (!imageData || !imageData.width || !imageData.height) {
            throw new Error('Invalid image data provided to AlbedoMapper');
        }

        const width  = imageData.width;
        const height = imageData.height;
        const input  = imageData.data;
        const output = new ImageData(width, height);
        const outBuf = output.data;

        // For each pixel: adjust brightness, contrast, saturation
        for (let i = 0; i < input.length; i += 4) {
            // Read original
            let r = input[i];
            let g = input[i + 1];
            let b = input[i + 2];
            const a = input[i + 3];

            // Brightness: simple scale
            r = r * this.brightness;
            g = g * this.brightness;
            b = b * this.brightness;

            // Contrast: pivot at 128
            r = (r - 128) * this.contrast + 128;
            g = (g - 128) * this.contrast + 128;
            b = (b - 128) * this.contrast + 128;

            // Saturation: convert to grayscale then lerp
            const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;
            r = gray + (r - gray) * this.saturation;
            g = gray + (g - gray) * this.saturation;
            b = gray + (b - gray) * this.saturation;

            // Write out, clamp to [0,255]
            outBuf[i]     = Math.min(255, Math.max(0, r));
            outBuf[i + 1] = Math.min(255, Math.max(0, g));
            outBuf[i + 2] = Math.min(255, Math.max(0, b));
            outBuf[i + 3] = a;
        }

        return output;
    }
}

// Integration with Three.js
import * as THREE from 'three';

/**
 * Three.js integration for Albedo Mapping
 */
export class ThreeJsAlbedoMapper {
    /**
     * @param {Object} options - Options for the AlbedoMapper and preview
     */
    constructor(options = {}) {
        this.mapper = new AlbedoMapper(options);
        this.options = {
            showPreviews: options.showPreviews !== undefined ? options.showPreviews : true,
            previewSize:  options.previewSize  || 128,
            debugLogs:    options.debugLogs    || false
        };
        this._previewElements = [];
    }

    /**
     * Process an image URL and create a THREE.Texture
     * @param {string} imageUrl
     * @returns {Promise<THREE.Texture>}
     */
    createAlbedoTexture(imageUrl) {
        return new Promise((resolve, reject) => {
            this._cleanupPreviews();
            const img = new Image();
            img.crossOrigin = 'Anonymous';

            img.onload = () => {
                try {
                    const canvas = document.createElement('canvas');
                    const ctx    = canvas.getContext('2d');
                    canvas.width  = img.width;
                    canvas.height = img.height;
                    ctx.drawImage(img, 0, 0);

                    const srcData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    const outData = this.mapper.generateAlbedoMap(srcData);

                    // Render to output canvas
                    const outCanvas = document.createElement('canvas');
                    outCanvas.width  = outData.width;
                    outCanvas.height = outData.height;
                    outCanvas.getContext('2d').putImageData(outData, 0, 0);

                    if (this.options.showPreviews) {
                        this._createPreviews(outCanvas);
                    }

                    const texture = new THREE.Texture(outCanvas);
                    texture.wrapS = THREE.RepeatWrapping;
                    texture.wrapT = THREE.RepeatWrapping;
                    texture.needsUpdate = true;

                    resolve(texture);
                } catch (error) {
                    console.error('[AlbedoMap] Error generating albedo map:', error);
                    reject(error);
                }
            };

            img.onerror = (err) => {
                console.error('[AlbedoMap] Image load failed:', err);
                reject(new Error(`Failed to load image: ${imageUrl}`));
            };

            img.src = imageUrl;
        });
    }

    /**
     * Display preview canvases
     * @param {HTMLCanvasElement} canvas
     * @private
     */
    _createPreviews(canvas) {
        const size = this.options.previewSize;
        // Canvas preview
        const cvPrev = canvas.cloneNode(true);
        cvPrev.className = 'albedo-preview';
        cvPrev.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            width: ${size}px;
            height: ${size}px;
            border: 2px solid #fff;
            z-index: 9999;
        `;
        document.body.appendChild(cvPrev);
        this._previewElements.push(cvPrev);

        if (this.options.debugLogs) {
            console.log('[AlbedoMap] Preview appended');
        }
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
     * Clean up resources
     */
    dispose() {
        this._cleanupPreviews();
    }

    /**
     * Static helper to apply albedo map to a mesh
     * @param {THREE.Mesh} mesh
     * @param {string} imageUrl
     * @param {Object} options
     * @returns {Promise<THREE.Texture>}
     */
    static async applyToMesh(mesh, imageUrl, options = {}) {
        if (!mesh) throw new Error('[AlbedoMap] Invalid mesh provided');
        const mapper = new ThreeJsAlbedoMapper(options);
        try {
            const albedoTex = await mapper.createAlbedoTexture(imageUrl);
            if (mesh.material) {
                if (mesh.material.map) mesh.material.map.dispose();
                mesh.material.map = albedoTex;
                mesh.material.needsUpdate = true;
            }
            return albedoTex;
        } finally {
            mapper._cleanupPreviews();
        }
    }
}
