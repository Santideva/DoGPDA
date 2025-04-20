// BumpToNormalMapper.js
import * as THREE from 'three';

/**
 * Core normal map generation algorithm using a complex gradient approach
 * @class BumpToNormalMapper
 */
export class BumpToNormalMapper {
    /**
     * Creates a new normal map generator instance
     * @param {Object} options - Configuration options
     * @param {number} options.strength - Normal map intensity (default: 1.0)
     * @param {string} options.gradientType - Gradient calculation method ('central', 'sobel', 'prewitt') (default: 'central')
     * @param {boolean} options.debug - Enable debug visualization (default: false)
     */
    constructor(options = {}) {
        // Configuration parameters with validation
        this.strength = this._validateStrength(options.strength ?? 1.0);
        this.gradientType = options.gradientType || 'central';
        this.debug = options.debug || false;
        
        // Processing pipeline steps
        this.pipeline = {
            INIT: 'init',
            SCAN: 'scan',
            COMPLEX_GRAD: 'complex_grad',
            VECTOR_MAP: 'vector_map',
            NORMALIZE: 'normalize',
            ENCODE: 'encode',
            ACCEPT: 'accept'
        };
        
        // Initialize state and processing data
        this.currentState = this.pipeline.INIT;
        this.processingData = {
            bump: null,
            gradients: null,
            vectors: null,
            normalMap: null
        };
        
        // Progress callback
        this.onProgress = null;
    }
    
    /**
     * Validates strength parameter is numeric and within reasonable bounds
     * @private
     * @param {number} strength - Normal map strength
     * @returns {number} - Validated strength value
     */
    _validateStrength(strength) {
        if (typeof strength !== 'number' || isNaN(strength)) {
            console.warn('[BumpToNormal] Invalid strength parameter, using default 1.0');
            return 1.0;
        }
        // Clamp to reasonable range
        return Math.max(0.01, Math.min(10.0, strength));
    }
    
    /**
     * Set progress callback function
     * @param {Function} callback - Function(progress, stage) called during processing
     * @returns {BumpToNormalMapper} - This instance for chaining
     */
    setProgressCallback(callback) {
        if (typeof callback === 'function') {
            this.onProgress = callback;
        }
        return this;
    }
    
    /**
     * Entry point: takes bump ImageData, returns normal ImageData
     * @param {ImageData} bumpMapData - Input bump map as ImageData
     * @returns {ImageData} - Generated normal map as ImageData
     */
    generateNormalMap(bumpMapData) {
        if (!bumpMapData || !bumpMapData.data || !bumpMapData.width || !bumpMapData.height) {
            throw new Error('[BumpToNormal] Invalid bump map data provided');
        }
        
        console.log("[BumpToNormal] Starting normal map generation");
        this._reportProgress(0, 'init');
        
        // Store input bump data (clone to avoid mutations)
        this.processingData.bump = this._cloneImageData(bumpMapData);
        this._reportProgress(10, 'scan');
        
        // Process through pipeline stages
        this.currentState = this.pipeline.SCAN;
        
        // Drive pipeline transitions until ACCEPT
        while (this.currentState !== this.pipeline.ACCEPT) {
            this._transition();
        }
        
        this._reportProgress(100, 'complete');
        return this.processingData.normalMap;
    }
    
    /**
     * Pipeline state machine transition handler
     * @private
     */
    _transition() {
        switch (this.currentState) {
            case this.pipeline.SCAN:
                this.currentState = this.pipeline.COMPLEX_GRAD;
                this._computeComplexGradients();
                this._reportProgress(30, 'gradients');
                break;
                
            case this.pipeline.COMPLEX_GRAD:
                this.currentState = this.pipeline.VECTOR_MAP;
                this._mapToVectorField();
                this._reportProgress(50, 'vectors');
                break;
                
            case this.pipeline.VECTOR_MAP:
                this.currentState = this.pipeline.NORMALIZE;
                this._normalizeVectors();
                this._reportProgress(70, 'normalize');
                break;
                
            case this.pipeline.NORMALIZE:
                this.currentState = this.pipeline.ENCODE;
                this._encodeAsRGB();
                this._reportProgress(90, 'encode');
                break;
                
            case this.pipeline.ENCODE:
                this.currentState = this.pipeline.ACCEPT;
                this._reportProgress(95, 'finalize');
                break;
                
            default:
                console.warn(`[BumpToNormal] Unknown state: ${this.currentState}`);
                this.currentState = this.pipeline.ACCEPT;
        }
    }
    
    /**
     * Report progress to callback if defined
     * @private
     * @param {number} percent - Progress percentage (0-100)
     * @param {string} stage - Current processing stage
     */
    _reportProgress(percent, stage) {
        if (typeof this.onProgress === 'function') {
            this.onProgress(percent, stage);
        }
    }
    
    /**
     * Compute gradients dx, dy from bump heights using selected method
     * @private
     */
    _computeComplexGradients() {
        const bumpMap = this.processingData.bump;
        const width = bumpMap.width;
        const height = bumpMap.height;
        console.log(`[BumpToNormal] Computing ${this.gradientType} gradients for ${width}×${height}`);
        
        // Pre-allocate gradients array (2 components per pixel: dx, dy)
        const gradients = new Float32Array(width * height * 2);
        
        // Choose gradient computation method
        switch (this.gradientType) {
            case 'sobel':
                this._computeSobelGradients(bumpMap, gradients, width, height);
                break;
            case 'prewitt':
                this._computePrewittGradients(bumpMap, gradients, width, height);
                break;
            case 'central':
            default:
                this._computeCentralGradients(bumpMap, gradients, width, height);
                break;
        }
        
        // Store gradients for next step
        this.processingData.gradients = { data: gradients, width, height };
        
        // Visualize gradients in debug mode
        if (this.debug) {
            this._visualizeGradients(gradients, width, height);
        }
    }
    
    /**
     * Compute central difference gradients (original method)
     * @private
     * @param {ImageData} bumpMap - Bump map data
     * @param {Float32Array} gradients - Output gradients array
     * @param {number} width - Image width
     * @param {number} height - Image height
     */
    _computeCentralGradients(bumpMap, gradients, width, height) {
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                const h = bumpMap.data[idx] / 255.0;
                
                // Use central difference with edge handling
                const left = x > 0 ? bumpMap.data[idx - 4] / 255.0 : h;
                const right = x < width - 1 ? bumpMap.data[idx + 4] / 255.0 : h;
                const top = y > 0 ? bumpMap.data[(y - 1) * width * 4 + x * 4] / 255.0 : h;
                const bottom = y < height - 1 ? bumpMap.data[(y + 1) * width * 4 + x * 4] / 255.0 : h;
                
                // Apply central difference formula with strength factor
                const dx = (right - left) * 0.5 * this.strength;
                const dy = (bottom - top) * 0.5 * this.strength;
                
                // Store in gradients array
                gradients[(y * width + x) * 2] = dx;
                gradients[(y * width + x) * 2 + 1] = dy;
            }
        }
    }
    
    /**
     * Compute Sobel operator gradients
     * @private
     * @param {ImageData} bumpMap - Bump map data
     * @param {Float32Array} gradients - Output gradients array
     * @param {number} width - Image width
     * @param {number} height - Image height
     */
    _computeSobelGradients(bumpMap, gradients, width, height) {
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                // Sample 3x3 neighborhood with safe bounds checking
                const samples = this._getSampleNeighborhood(bumpMap, x, y, width, height);
                
                // Sobel X kernel: [-1,0,1; -2,0,2; -1,0,1]
                const gx = (
                    -1.0 * samples[0][0] + 1.0 * samples[0][2] +
                    -2.0 * samples[1][0] + 2.0 * samples[1][2] +
                    -1.0 * samples[2][0] + 1.0 * samples[2][2]
                ) * this.strength / 8.0;
                
                // Sobel Y kernel: [-1,-2,-1; 0,0,0; 1,2,1]
                const gy = (
                    -1.0 * samples[0][0] - 2.0 * samples[0][1] - 1.0 * samples[0][2] +
                     1.0 * samples[2][0] + 2.0 * samples[2][1] + 1.0 * samples[2][2]
                ) * this.strength / 8.0;
                
                // Store in gradients array
                gradients[(y * width + x) * 2] = gx;
                gradients[(y * width + x) * 2 + 1] = gy;
            }
        }
    }
    
    /**
     * Compute Prewitt operator gradients
     * @private
     * @param {ImageData} bumpMap - Bump map data
     * @param {Float32Array} gradients - Output gradients array
     * @param {number} width - Image width
     * @param {number} height - Image height
     */
    _computePrewittGradients(bumpMap, gradients, width, height) {
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                // Sample 3x3 neighborhood with safe bounds checking
                const samples = this._getSampleNeighborhood(bumpMap, x, y, width, height);
                
                // Prewitt X kernel: [-1,0,1; -1,0,1; -1,0,1]
                const gx = (
                    -1.0 * samples[0][0] + 1.0 * samples[0][2] +
                    -1.0 * samples[1][0] + 1.0 * samples[1][2] +
                    -1.0 * samples[2][0] + 1.0 * samples[2][2]
                ) * this.strength / 6.0;
                
                // Prewitt Y kernel: [-1,-1,-1; 0,0,0; 1,1,1]
                const gy = (
                    -1.0 * samples[0][0] - 1.0 * samples[0][1] - 1.0 * samples[0][2] +
                     1.0 * samples[2][0] + 1.0 * samples[2][1] + 1.0 * samples[2][2]
                ) * this.strength / 6.0;
                
                // Store in gradients array
                gradients[(y * width + x) * 2] = gx;
                gradients[(y * width + x) * 2 + 1] = gy;
            }
        }
    }
    
    /**
     * Get 3x3 neighborhood samples with edge handling
     * @private
     * @param {ImageData} imageData - Source image data
     * @param {number} x - Center x coordinate
     * @param {number} y - Center y coordinate
     * @param {number} width - Image width
     * @param {number} height - Image height
     * @returns {Array<Array<number>>} 3x3 array of normalized pixel values
     */
    _getSampleNeighborhood(imageData, x, y, width, height) {
        const samples = [
            [0, 0, 0],
            [0, 0, 0],
            [0, 0, 0]
        ];
        
        // Sample 3x3 neighborhood with mirror padding
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                // Mirror padding for edges
                const sx = Math.max(0, Math.min(width - 1, x + dx));
                const sy = Math.max(0, Math.min(height - 1, y + dy));
                
                // Get normalized value (0-1)
                const idx = (sy * width + sx) * 4;
                samples[dy + 1][dx + 1] = imageData.data[idx] / 255.0;
            }
        }
        
        return samples;
    }
    
    /**
     * Map each gradient to a 3D vector
     * @private
     */
    _mapToVectorField() {
        const { data: gradients, width, height } = this.processingData.gradients;
        console.log("[BumpToNormal] Mapping gradients to vector field");
        
        // Pre-allocate vector field (3 components per pixel: x, y, z)
        const vectors = new Float32Array(width * height * 3);
        
        // Create vectors from gradients
        for (let i = 0; i < width * height; i++) {
            const gi = i * 2;
            const vi = i * 3;
            
            // Gradient components
            const vx = gradients[gi];
            const vy = gradients[gi + 1];
            const vz = 1.0; // z points outward from surface
            
            // Store unnormalized vector components
            vectors[vi] = vx;
            vectors[vi + 1] = vy;
            vectors[vi + 2] = vz;
        }
        
        // Store vectors for next step
        this.processingData.vectors = { data: vectors, width, height };
        
        // Visualize vector field in debug mode
        if (this.debug) {
            this._visualizeVectorField(vectors, width, height);
        }
    }
    
    /**
     * Normalize vector field to unit vectors
     * @private
     */
    _normalizeVectors() {
        const { data: vectors, width, height } = this.processingData.vectors;
        console.log("[BumpToNormal] Normalizing vectors");
        
        // For each vector in field, normalize to unit length
        for (let i = 0; i < vectors.length; i += 3) {
            const x = vectors[i];
            const y = vectors[i + 1];
            const z = vectors[i + 2];
            
            // Calculate length with epsilon to avoid division by zero
            const len = Math.sqrt(x*x + y*y + z*z) || 0.00001;
            
            // Normalize components
            vectors[i] = x / len;
            vectors[i + 1] = y / len;
            vectors[i + 2] = z / len;
        }
        
        // Store normalized vectors (in-place modification)
        this.processingData.vectors = { data: vectors, width, height };
    }
    
    /**
     * Encode normalized vectors as RGB in standard normal map format
     * @private
     */
    _encodeAsRGB() {
        const { data: vectors, width, height } = this.processingData.vectors;
        console.log("[BumpToNormal] Encoding normals as RGB");
        
        // Create output normal map ImageData
        const normalMap = new ImageData(width, height);
        
        // Encode normalized vectors to RGB color space
        // Normal maps store vectors as: 
        // R = x * 0.5 + 0.5 (X component mapped from [-1,1] to [0,1])
        // G = y * 0.5 + 0.5 (Y component mapped from [-1,1] to [0,1])
        // B = z * 0.5 + 0.5 (Z component mapped from [-1,1] to [0,1])
        // A = 255 (Fully opaque)
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const vi = (y * width + x) * 3;
                const ni = (y * width + x) * 4;
                
                // Map from [-1,1] to [0,1] then to [0,255]
                normalMap.data[ni] = Math.max(0, Math.min(255, Math.floor((vectors[vi] * 0.5 + 0.5) * 255)));
                normalMap.data[ni + 1] = Math.max(0, Math.min(255, Math.floor((vectors[vi + 1] * 0.5 + 0.5) * 255)));
                normalMap.data[ni + 2] = Math.max(0, Math.min(255, Math.floor((vectors[vi + 2] * 0.5 + 0.5) * 255)));
                normalMap.data[ni + 3] = 255; // Alpha always fully opaque
            }
        }
        
        // Store final normal map
        this.processingData.normalMap = normalMap;
    }
    
    /**
     * Debug visualization of gradients
     * @private
     * @param {Float32Array} gradients - Gradient data
     * @param {number} width - Image width
     * @param {number} height - Image height
     */
    _visualizeGradients(gradients, width, height) {
        // Create debug canvas for gradients
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.id = 'debug-gradients';
        canvas.style.cssText = `
            position: fixed;
            bottom: 150px;
            right: 10px;
            width: 128px;
            height: 128px;
            border: 2px solid #f00;
            z-index: 9999;
        `;
        
        const ctx = canvas.getContext('2d');
        const imgData = ctx.createImageData(width, height);
        
        // Visualize gradient magnitudes
        for (let i = 0; i < width * height; i++) {
            const dx = gradients[i * 2];
            const dy = gradients[i * 2 + 1];
            const magnitude = Math.sqrt(dx * dx + dy * dy) * 255;
            const direction = Math.atan2(dy, dx) / (Math.PI * 2) + 0.5;
            
            imgData.data[i * 4] = magnitude; // Red for magnitude
            imgData.data[i * 4 + 1] = direction * 255; // Green for direction
            imgData.data[i * 4 + 2] = 0;
            imgData.data[i * 4 + 3] = 255;
        }
        
        ctx.putImageData(imgData, 0, 0);
        document.body.appendChild(canvas);
    }
    
    /**
     * Debug visualization of vector field
     * @private
     * @param {Float32Array} vectors - Vector field data
     * @param {number} width - Image width
     * @param {number} height - Image height
     */
    _visualizeVectorField(vectors, width, height) {
        // Create debug canvas for vector field
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.id = 'debug-vectors';
        canvas.style.cssText = `
            position: fixed;
            bottom: 150px;
            left: 10px;
            width: 128px;
            height: 128px;
            border: 2px solid #00f;
            z-index: 9999;
        `;
        
        const ctx = canvas.getContext('2d');
        const imgData = ctx.createImageData(width, height);
        
        // Basic visualization for unnormalized vectors
        for (let i = 0; i < width * height; i++) {
            const vx = vectors[i * 3];
            const vy = vectors[i * 3 + 1];
            const vz = vectors[i * 3 + 2];
            
            // Simple color mapping for vectors
            imgData.data[i * 4] = Math.abs(vx) * 255; // R = |x|
            imgData.data[i * 4 + 1] = Math.abs(vy) * 255; // G = |y|
            imgData.data[i * 4 + 2] = Math.abs(vz) * 255; // B = |z|
            imgData.data[i * 4 + 3] = 255;
        }
        
        ctx.putImageData(imgData, 0, 0);
        document.body.appendChild(canvas);
    }
    
    /**
     * Deep clone ImageData safely
     * @private
     * @param {ImageData} imageData - Source image data
     * @returns {ImageData} - Cloned image data
     */
    _cloneImageData(imageData) {
        return new ImageData(
            new Uint8ClampedArray(imageData.data),
            imageData.width,
            imageData.height
        );
    }
    
    /**
     * Clean up any created debug elements
     */
    cleanup() {
        // Remove debug canvases if they exist
        const debugElements = document.querySelectorAll('#debug-gradients, #debug-vectors');
        debugElements.forEach(el => el.remove());
    }
}

/**
 * Factory and integration with Three.js
 */
export class ThreeJsBumpToNormalMapper {
    /**
     * @param {Object} options - Configuration options
     * @param {number} options.strength - Normal map intensity (default: 1.0)
     * @param {string} options.gradientType - Gradient calculation method (default: 'central')
     * @param {boolean} options.debug - Enable debug visualization (default: false)
     * @param {boolean} options.showPreview - Show preview on page (default: true)
     */
    constructor(options = {}) {
        this.options = {
            strength: options.strength || 1.0,
            gradientType: options.gradientType || 'central',
            debug: options.debug || false,
            showPreview: options.showPreview !== false, // Default to true
            previewSize: options.previewSize || 128,
            previewPosition: options.previewPosition || { bottom: '10px', right: '10px' }
        };
        
        // Create mapper instance
        this.normalMapper = new BumpToNormalMapper(this.options);
        
        // Preview element reference for cleanup
        this.previewElement = null;
        
        // Progress callback
        if (typeof options.onProgress === 'function') {
            this.normalMapper.setProgressCallback(options.onProgress);
        }
    }

    /**
     * Takes bump ImageData, creates a preview canvas and Three.js texture
     * @param {ImageData} bumpImageData - Input bump map
     * @returns {THREE.Texture} - Generated normal map texture
     */
    createNormalMapFromBump(bumpImageData) {
        console.groupCollapsed("%c[BumpToNormal] Converting bump map to normal map", "color: blue; font-weight:bold");
        const start = performance.now();
        
        try {
            // First clean up any previous preview
            this._cleanupPreviews();
            
            // Generate normal map ImageData using core mapper
            const normalMapData = this.normalMapper.generateNormalMap(bumpImageData);
            
            // Create output canvas for texture
            const outputCanvas = document.createElement('canvas');
            outputCanvas.width = normalMapData.width;
            outputCanvas.height = normalMapData.height;
            const ctx = outputCanvas.getContext('2d');
            ctx.putImageData(normalMapData, 0, 0);
            
            // Create preview if enabled
            if (this.options.showPreview) {
                this._createPreview(outputCanvas);
            }
            
            // Create Three.js texture from canvas
            const normalTexture = new THREE.Texture(outputCanvas);
            normalTexture.needsUpdate = true;
            normalTexture.wrapS = THREE.RepeatWrapping;
            normalTexture.wrapT = THREE.RepeatWrapping;
            
            const elapsed = (performance.now() - start).toFixed(1);
            console.log(`⏱️ Completed in ${elapsed}ms`);
            console.log("%c[BumpToNormal] Success ✅", "color: green;");
            console.groupEnd();
            
            return normalTexture;
        } catch (err) {
            console.error("[BumpToNormal] Error generating normal map:", err);
            console.groupEnd();
            throw err;
        }
    }
    
    /**
     * Create and show preview element
     * @private
     * @param {HTMLCanvasElement} canvas - Source canvas
     */
    _createPreview(canvas) {
        // Clean up any existing preview first
        this._cleanupPreviews();
        
        // Create preview element
        const preview = document.createElement('canvas');
        preview.width = canvas.width;
        preview.height = canvas.height;
        preview.className = 'bump-to-normal-preview';
        preview.style.cssText = `
            position: fixed;
            bottom: ${this.options.previewPosition.bottom};
            right: ${this.options.previewPosition.right};
            width: ${this.options.previewSize}px;
            height: ${this.options.previewSize}px;
            border: 2px solid #fff;
            z-index: 9999;
        `;
        
        // Copy content from source canvas
        const ctx = preview.getContext('2d');
        ctx.drawImage(canvas, 0, 0);
        
        // Add to DOM and store reference
        document.body.appendChild(preview);
        this.previewElement = preview;
    }
    
    /**
     * Clean up preview elements
     * @private
     */
    _cleanupPreviews() {
        // Remove previous preview if exists
        if (this.previewElement && document.body.contains(this.previewElement)) {
            document.body.removeChild(this.previewElement);
        }
        
        // Also remove any other previews with the same class (safety cleanup)
        document.querySelectorAll('.bump-to-normal-preview').forEach(el => {
            el.parentElement.removeChild(el);
        });
        
        // Clean up debug visualizations
        this.normalMapper.cleanup();
    }

    /**
     * Static: takes a bump Texture, extracts ImageData, returns normal Texture
     * @param {THREE.Texture} bumpTexture - Input bump map texture
     * @param {Object} options - Configuration options
     * @returns {Promise<THREE.Texture>} - Promise resolving to normal map texture
     */
    static createNormalMap(bumpTexture, options = {}) {
        return new Promise((resolve, reject) => {
            try {
                // Validate input
                if (!bumpTexture || !bumpTexture.image) {
                    throw new Error('Invalid bump texture provided');
                }
                
                // Extract image data from texture
                const canvas = document.createElement('canvas');
                const width = bumpTexture.image.width || bumpTexture.image.naturalWidth;
                const height = bumpTexture.image.height || bumpTexture.image.naturalHeight;
                
                if (!width || !height) {
                    throw new Error('Invalid bump texture dimensions');
                }
                
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(bumpTexture.image, 0, 0);
                
                // Get image data for processing
                let bumpData;
                try {
                    bumpData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                } catch (err) {
                    console.error('Error accessing image data:', err);
                    // Try fallback for cross-origin images
                    if (err.name === 'SecurityError') {
                        throw new Error('Cannot access cross-origin image. Make sure the image has CORS headers.');
                    }
                    throw err;
                }
                
                // Create mapper and process
                const mapper = new ThreeJsBumpToNormalMapper(options);
                const normalTexture = mapper.createNormalMapFromBump(bumpData);
                resolve(normalTexture);
            } catch (err) {
                console.error('Error creating normal map:', err);
                reject(err);
            }
        });
    }

    /**
     * Static: apply normal map to a mesh's material
     * @param {THREE.Mesh} mesh - Target mesh
     * @param {THREE.Texture} bumpTexture - Input bump map texture
     * @param {Object} options - Configuration options
     * @returns {Promise<THREE.Texture>} - Promise resolving to applied normal map texture
     */
    static async applyToMesh(mesh, bumpTexture, options = {}) {
        try {
            // Validate mesh
            if (!mesh || !mesh.material) {
                throw new Error('Invalid mesh or material');
            }
            
            // Generate normal map from bump
            const normalTexture = await ThreeJsBumpToNormalMapper.createNormalMap(bumpTexture, options);
            
            // Apply to mesh material
            if (mesh.material) {
                // Clean up previous normal map if exists
                if (mesh.material.normalMap) {
                    mesh.material.normalMap.dispose();
                }
                
                // Apply new normal map
                mesh.material.normalMap = normalTexture;
                mesh.material.normalScale = new THREE.Vector2(
                    options.normalScale || 1.0,
                    options.normalScale || 1.0
                );
                mesh.material.needsUpdate = true;
            }
            
            return normalTexture;
        } catch (err) {
            console.error('Error applying normal map to mesh:', err);
            throw err;
        }
    }
    
    /**
     * Clean up resources
     */
    dispose() {
        this._cleanupPreviews();
        this.normalMapper.cleanup();
    }
}