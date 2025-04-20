// DoG Bump Mapping System
// This implementation uses Difference of Gaussians to generate bump maps from images

/**
 * Class for generating bump maps using Difference of Gaussians algorithm
 */
export class DoGBumpMapper {
    /**
     * Create a new DoG Bump Mapper
     * @param {Object} options - Configuration options
     * @param {number} [options.sigma1=1.0] - First Gaussian blur radius
     * @param {number} [options.sigma2=2.0] - Second Gaussian blur radius
     * @param {number} [options.heightScale=1.0] - Bump height multiplier
     * @param {number} [options.threshold=0.1] - Edge detection threshold
     * @param {boolean} [options.showDebugLogs=false] - Enable debug logging
     */
    constructor(options = {}) {
        // Default parameters
        this.sigma1 = Math.max(0.1, options.sigma1 || 1.0);  // First Gaussian blur radius
        this.sigma2 = Math.max(0.1, options.sigma2 || 2.0);  // Second Gaussian blur radius
        this.heightScale = options.heightScale || 1.0; // Bump height multiplier
        this.threshold = options.threshold || 0.1; // Edge detection threshold
        this.showDebugLogs = options.showDebugLogs || false; // Debug log toggle

        // Results
        this.bumpMap = null;
        
        // Kernel cache to avoid recalculation
        this.kernelCache = new Map();
    }

    /**
     * Main processing function
     * @param {ImageData} imageData - Input image data
     * @returns {ImageData} Generated bump map as ImageData
     */
    generateBumpMap(imageData) {
        if (!imageData || !imageData.width || !imageData.height) {
            throw new Error('Invalid image data provided to DoGBumpMapper');
        }
        
        // Initialize with input image
        const width = imageData.width;
        const height = imageData.height;
        
        // Clone the original image data
        const originalImage = this._cloneImageData(imageData);
        
        // Apply Gaussian blurs at different scales
        const blurredImage1 = this._applyGaussianBlur(originalImage, this.sigma1);
        const blurredImage2 = this._applyGaussianBlur(originalImage, this.sigma2);
        
        // Compute difference of Gaussians
        const dogResult = this._differenceOfGaussians(blurredImage1, blurredImage2);
        
        // Generate bump map values based on DoG results
        this.bumpMap = this._generateBumpValues(dogResult);
        
        return this.bumpMap;
    }

    /**
     * Generate bump map values based on DoG results
     * @param {ImageData} dogImage - Difference of Gaussians result
     * @returns {ImageData} Generated bump map
     * @private
     */
    _generateBumpValues(dogImage) {
        const width = dogImage.width;
        const height = dogImage.height;

        // Create output bump map
        const bumpMap = new ImageData(width, height);

        // Apply threshold and convert to height values
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;

                // Get average of RGB channels as intensity
                const dogValue = (dogImage.data[idx] + dogImage.data[idx + 1] + dogImage.data[idx + 2]) / 3;

                // Apply threshold and scale
                let bumpValue = 0;
                if (Math.abs(dogValue) > this.threshold) {
                    bumpValue = Math.min(255, Math.max(0, 128 + dogValue * this.heightScale));
                } else {
                    bumpValue = 128; // Neutral height
                }

                // Store in RGB channels (normal maps typically use RGB)
                bumpMap.data[idx] = bumpValue;
                bumpMap.data[idx + 1] = bumpValue;
                bumpMap.data[idx + 2] = bumpValue;
                bumpMap.data[idx + 3] = 255; // Alpha
            }
        }

        return bumpMap;
    }

    /**
     * Apply Gaussian blur to an image
     * @param {ImageData} imageData - Input image data
     * @param {number} sigma - Gaussian sigma (standard deviation)
     * @returns {ImageData} Blurred image data
     * @private
     */
    _applyGaussianBlur(imageData, sigma) {
        const width = imageData.width;
        const height = imageData.height;
        const result = this._cloneImageData(imageData);

        // Kernel size based on sigma (typically 6*sigma)
        // Ensure kernel size is odd for proper centering
        const kernelSize = Math.max(3, Math.ceil(sigma * 6));
        const kernelSizeOdd = kernelSize % 2 === 0 ? kernelSize + 1 : kernelSize;
        const halfSize = Math.floor(kernelSizeOdd / 2);

        // Generate or retrieve 1D Gaussian kernel for separable implementation
        const kernel = this._getGaussianKernel(sigma, kernelSizeOdd);

        // Temporary buffer for horizontal pass - use Float32Array for better precision
        const tempBuffer = new Float32Array(width * height * 4);

        // Horizontal pass
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let r = 0, g = 0, b = 0, weightSum = 0;

                for (let i = -halfSize; i <= halfSize; i++) {
                    // Better edge handling with mirror boundary condition
                    let srcX = x + i;
                    // Mirror boundary conditions
                    if (srcX < 0) srcX = -srcX;
                    if (srcX >= width) srcX = 2 * width - srcX - 2;
                    
                    const srcIdx = (y * width + srcX) * 4;
                    const weight = kernel[i + halfSize];

                    r += imageData.data[srcIdx] * weight;
                    g += imageData.data[srcIdx + 1] * weight;
                    b += imageData.data[srcIdx + 2] * weight;
                    weightSum += weight;
                }

                const destIdx = (y * width + x) * 4;
                // Avoid division by zero
                const scale = weightSum > 0.00001 ? 1 / weightSum : 0;
                tempBuffer[destIdx] = r * scale;
                tempBuffer[destIdx + 1] = g * scale;
                tempBuffer[destIdx + 2] = b * scale;
                tempBuffer[destIdx + 3] = imageData.data[destIdx + 3]; // Copy alpha
            }
        }

        // Vertical pass
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let r = 0, g = 0, b = 0, weightSum = 0;

                for (let j = -halfSize; j <= halfSize; j++) {
                    // Better edge handling with mirror boundary condition
                    let srcY = y + j;
                    // Mirror boundary conditions
                    if (srcY < 0) srcY = -srcY;
                    if (srcY >= height) srcY = 2 * height - srcY - 2;
                    
                    const srcIdx = (srcY * width + x) * 4;
                    const weight = kernel[j + halfSize];

                    r += tempBuffer[srcIdx] * weight;
                    g += tempBuffer[srcIdx + 1] * weight;
                    b += tempBuffer[srcIdx + 2] * weight;
                    weightSum += weight;
                }

                const destIdx = (y * width + x) * 4;
                // Avoid division by zero
                const scale = weightSum > 0.00001 ? 1 / weightSum : 0;
                result.data[destIdx] = Math.min(255, Math.max(0, r * scale));
                result.data[destIdx + 1] = Math.min(255, Math.max(0, g * scale));
                result.data[destIdx + 2] = Math.min(255, Math.max(0, b * scale));
                result.data[destIdx + 3] = imageData.data[destIdx + 3]; // Copy alpha
            }
        }

        return result;
    }

    /**
     * Get or generate 1D Gaussian kernel with caching
     * @param {number} sigma - Gaussian sigma
     * @param {number} size - Kernel size
     * @returns {Array} Normalized kernel array
     * @private
     */
    _getGaussianKernel(sigma, size) {
        // Check if we have this kernel cached
        const cacheKey = `${sigma}_${size}`;
        if (this.kernelCache.has(cacheKey)) {
            return this.kernelCache.get(cacheKey);
        }
        
        // Generate new kernel
        const kernel = this._generateGaussianKernel(sigma, size);
        // Cache it for future use
        this.kernelCache.set(cacheKey, kernel);
        return kernel;
    }

    /**
     * Generate 1D Gaussian kernel
     * @param {number} sigma - Gaussian sigma
     * @param {number} size - Kernel size
     * @returns {Array} Normalized kernel array
     * @private
     */
    _generateGaussianKernel(sigma, size) {
        const kernel = new Array(size);
        const center = Math.floor(size / 2);

        // Calculate kernel values
        for (let i = 0; i < size; i++) {
            const x = i - center;
            kernel[i] = Math.exp(-(x * x) / (2 * sigma * sigma));
        }

        // Normalize kernel
        const sum = kernel.reduce((a, b) => a + b, 0);
        if (sum < 0.00001) {
            // Avoid division by zero
            return kernel.map(() => 1.0 / size);
        }
        return kernel.map(value => value / sum);
    }

    /**
     * Compute difference between two images
     * @param {ImageData} image1 - First image
     * @param {ImageData} image2 - Second image
     * @returns {ImageData} Difference image
     * @private
     */
    _differenceOfGaussians(image1, image2) {
        const width = image1.width;
        const height = image1.height;
        const result = new ImageData(width, height);

        for (let i = 0; i < image1.data.length; i += 4) {
            // Calculate difference for each channel
            result.data[i] = Math.abs(image1.data[i] - image2.data[i]);
            result.data[i + 1] = Math.abs(image1.data[i + 1] - image2.data[i + 1]);
            result.data[i + 2] = Math.abs(image1.data[i + 2] - image2.data[i + 2]);
            result.data[i + 3] = 255; // Alpha
        }

        return result;
    }

    /**
     * Clone image data
     * @param {ImageData} imageData - Original image data
     * @returns {ImageData} Cloned image data
     * @private
     */
    _cloneImageData(imageData) {
        const clone = new ImageData(
            new Uint8ClampedArray(imageData.data),
            imageData.width,
            imageData.height
        );
        return clone;
    }
}

// Integration with Three.js
import * as THREE from 'three';

/**
 * Three.js integration for DoG Bump Mapping
 */
export class ThreeJsDoGBumpMapper {
    /**
     * Create a new Three.js DoG Bump Mapper
     * @param {Object} options - Configuration options for DoGBumpMapper
     */
    constructor(options = {}) {
        this.dogMapper = new DoGBumpMapper(options);
        this.options = {
            showPreviews: options.showPreviews !== undefined ? options.showPreviews : true,
            previewSize: options.previewSize || 128,
            debugLogs: options.debugLogs !== undefined ? options.debugLogs : false
        };
        
        // Track previews for cleanup
        this._previewElements = [];
    }

    /**
     * Process an image and create a Three.js texture
     * @param {string} imageUrl - URL of the image to process
     * @returns {Promise<THREE.Texture>} Promise resolving to the created texture
     */
    createBumpTexture(imageUrl) {
        return new Promise((resolve, reject) => {
            // Clean up previous previews if they exist
            this._cleanupPreviews();
            
            const img = new Image();
            img.crossOrigin = "Anonymous";

            img.onload = () => {
                if (this.options.debugLogs) {
                    console.log(`[DoGBump] Image loaded (${img.width}×${img.height}):`, img.src);
                }
                
                try {
                    // Create canvas and get image data
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    ctx.drawImage(img, 0, 0);

                    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

                    // Generate bump map
                    const bumpMapData = this.dogMapper.generateBumpMap(imageData);

                    // Create output canvas for the bump map
                    const outputCanvas = document.createElement('canvas');
                    outputCanvas.width = bumpMapData.width;
                    outputCanvas.height = bumpMapData.height;
                    const outputCtx = outputCanvas.getContext('2d');
                    outputCtx.putImageData(bumpMapData, 0, 0);
                    
                    // Only add previews if enabled
                    if (this.options.showPreviews) {
                        this._createPreviews(outputCanvas);
                    }

                    // Create Three.js texture from bump map
                    const texture = new THREE.Texture(outputCanvas);
                    texture.wrapS = THREE.RepeatWrapping;
                    texture.wrapT = THREE.RepeatWrapping;
                    texture.needsUpdate = true;

                    resolve(texture);
                } catch (error) {
                    console.error('[DoGBump] Error generating bump map:', error);
                    reject(error);
                }
            };

            img.onerror = (error) => {
                console.error(`[DoGBump] Failed to load image: ${imageUrl}`, error);
                reject(new Error(`Failed to load image: ${imageUrl}`));
            };

            img.src = imageUrl;
        });
    }

    /**
     * Create and add preview elements to the DOM
     * @param {HTMLCanvasElement} outputCanvas - Canvas containing the bump map
     * @private
     */
    _createPreviews(outputCanvas) {
        // Create and style output canvas preview
        const canvasPreview = outputCanvas.cloneNode(true);
        canvasPreview.className = 'dog-bump-preview';
        canvasPreview.style.cssText = `
            position: fixed;
            bottom: 10px;
            right: 10px;
            width: ${this.options.previewSize}px;
            height: ${this.options.previewSize}px;
            border: 2px solid #fff;
            z-index: 9999;
        `;
        document.body.appendChild(canvasPreview);
        this._previewElements.push(canvasPreview);

        // Data URL conversion
        const dataURL = outputCanvas.toDataURL();
        
        if (this.options.debugLogs) {
            // Sample data check
            const ctx = outputCanvas.getContext('2d');
            const raw = ctx.getImageData(0, 0, 16, 1).data;
            const sample = [];
            for (let i = 0; i < 16*4; i += 4) {
                sample.push(raw[i]);
            }
            console.log("[DoGBump] bumpMap sample values:", sample);
            console.log("[DoGBump] bumpMap data URL:", dataURL);
        }

        // Create and style preview image
        const previewImg = document.createElement('img');
        previewImg.src = dataURL;
        previewImg.className = 'dog-bump-preview-img';
        previewImg.style.cssText = `
            position: fixed;
            bottom: 10px;
            left: 10px;
            width: ${this.options.previewSize}px;
            border: 2px solid #fff;
            z-index: 9999;
        `;
        document.body.appendChild(previewImg);
        this._previewElements.push(previewImg);
    }

    /**
     * Remove any preview elements that were created
     * @private
     */
    _cleanupPreviews() {
        // Remove all preview elements from the DOM
        this._previewElements.forEach(element => {
            if (element && element.parentNode) {
                element.parentNode.removeChild(element);
            }
        });
        // Clear the array
        this._previewElements = [];
    }

    /**
     * Clean up resources when done
     */
    dispose() {
        this._cleanupPreviews();
        // Clear kernel cache to free memory
        if (this.dogMapper.kernelCache) {
            this.dogMapper.kernelCache.clear();
        }
    }

    /**
     * Static method to apply bump map to a mesh
     * @param {THREE.Mesh} mesh - The mesh to apply the bump map to
     * @param {string} imageUrl - URL of the image to process
     * @param {Object} options - Configuration options
     * @returns {Promise<THREE.Texture>} Promise resolving to the created texture
     */
    static async applyToMesh(mesh, imageUrl, options = {}) {
        if (!mesh) {
            throw new Error('[DoGBump] Invalid mesh provided');
        }
        
        const mapper = new ThreeJsDoGBumpMapper(options);
        try {
            const bumpTexture = await mapper.createBumpTexture(imageUrl);

            // Apply as bump map to material
            if (mesh.material) {
                // Dispose of previous bump map to avoid memory leaks
                if (mesh.material.bumpMap) {
                    mesh.material.bumpMap.dispose();
                }
                
                mesh.material.bumpMap = bumpTexture;
                mesh.material.bumpScale = options.bumpScale || 0.1;
                mesh.material.needsUpdate = true;
            }

            return bumpTexture;
        } catch (error) {
            console.error('[DoGBump] Error applying bump map:', error);
            throw error;
        } finally {
            // Clean up mapper resources but leave the texture
            // (as it's now being used by the mesh)
            mapper._cleanupPreviews();
        }
    }
}