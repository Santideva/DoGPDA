// PDA-Based DoG Bump Mapping System
// This implementation uses a pushdown automaton approach to generate
// bump maps from images using Difference of Gaussians

export class DoGBumpMapPDA {
    constructor(options = {}) {
        // Default parameters
        this.sigma1 = options.sigma1 || 1.0;  // First Gaussian blur radius
        this.sigma2 = options.sigma2 || 2.0;  // Second Gaussian blur radius
        this.heightScale = options.heightScale || 1.0; // Bump height multiplier
        this.threshold = options.threshold || 0.1; // Edge detection threshold

        // PDA states
        this.states = {
            INIT: 'init',
            SCAN: 'scan',
            PROCESS: 'process',
            COMPARE: 'compare',
            BUMP: 'bump',
            ACCEPT: 'accept'
        };

        // Current state
        this.currentState = this.states.INIT;

        // Stack for the PDA
        this.stack = [];

        // Results
        this.bumpMap = null;
    }

    // Main processing function
    generateBumpMap(imageData) {
        // Initialize with input image
        const width = imageData.width;
        const height = imageData.height;
        this.stack.push({ type: 'original', data: this._cloneImageData(imageData) });
        this.currentState = this.states.SCAN;

        // Move to processing state
        this._transition(null);

        return this.bumpMap;
    }

    // PDA transition function
    _transition(input) {
        switch (this.currentState) {
            case this.states.INIT:
                this.currentState = this.states.SCAN;
                break;

            case this.states.SCAN:
                // All data is already pushed to stack during initialization
                this.currentState = this.states.PROCESS;
                this._processGaussianBlurs();
                break;

            case this.states.PROCESS:
                // After processing Gaussian blurs, move to comparison
                this.currentState = this.states.COMPARE;
                this._computeDoG();
                break;

            case this.states.COMPARE:
                // After computing DoG, generate bump map
                this.currentState = this.states.BUMP;
                this._generateBumpValues();
                break;

            case this.states.BUMP:
                // After generating bump values, accept the result
                this.currentState = this.states.ACCEPT;
                break;
        }
    }

    // Apply Gaussian blurs at different scales and push to stack
    _processGaussianBlurs() {
        const originalImage = this.stack[0].data;

        // Apply first Gaussian blur
        const blurredImage1 = this._applyGaussianBlur(originalImage, this.sigma1);
        this.stack.push({ type: 'gaussian', sigma: this.sigma1, data: blurredImage1 });

        // Apply second Gaussian blur
        const blurredImage2 = this._applyGaussianBlur(originalImage, this.sigma2);
        this.stack.push({ type: 'gaussian', sigma: this.sigma2, data: blurredImage2 });

        // Continue to next state
        this._transition(null);
    }

    // Compute Difference of Gaussians
    _computeDoG() {
        // Pop the two Gaussian blurred images
        const blurred2 = this.stack.pop().data;
        const blurred1 = this.stack.pop().data;

        // Compute difference
        const dogResult = this._differenceOfGaussians(blurred1, blurred2);
        this.stack.push({ type: 'dog', data: dogResult });

        // Continue to next state
        this._transition(null);
    }

    // Generate bump map values based on DoG results
    _generateBumpValues() {
        const dogImage = this.stack.pop().data;
        const width = dogImage.width;
        const height = dogImage.height;

        // Create output bump map
        this.bumpMap = new ImageData(width, height);

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
                this.bumpMap.data[idx] = bumpValue;
                this.bumpMap.data[idx + 1] = bumpValue;
                this.bumpMap.data[idx + 2] = bumpValue;
                this.bumpMap.data[idx + 3] = 255; // Alpha
            }
        }

        // Continue to next state
        this._transition(null);
    }

    // Gaussian blur implementation (simplified)
    _applyGaussianBlur(imageData, sigma) {
        const width = imageData.width;
        const height = imageData.height;
        const result = this._cloneImageData(imageData);

        // Kernel size based on sigma (typically 6*sigma)
        const kernelSize = Math.max(3, Math.ceil(sigma * 6));
        const halfSize = Math.floor(kernelSize / 2);

        // Generate 1D Gaussian kernel for separable implementation
        const kernel = this._generateGaussianKernel(sigma, kernelSize);

        // Temporary buffer for horizontal pass
        const tempBuffer = new Uint8ClampedArray(width * height * 4);

        // Horizontal pass
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let r = 0, g = 0, b = 0, weightSum = 0;

                for (let i = -halfSize; i <= halfSize; i++) {
                    const srcX = Math.min(width - 1, Math.max(0, x + i));
                    const srcIdx = (y * width + srcX) * 4;
                    const weight = kernel[i + halfSize];

                    r += imageData.data[srcIdx] * weight;
                    g += imageData.data[srcIdx + 1] * weight;
                    b += imageData.data[srcIdx + 2] * weight;
                    weightSum += weight;
                }

                const destIdx = (y * width + x) * 4;
                tempBuffer[destIdx] = r / weightSum;
                tempBuffer[destIdx + 1] = g / weightSum;
                tempBuffer[destIdx + 2] = b / weightSum;
                tempBuffer[destIdx + 3] = imageData.data[destIdx + 3]; // Copy alpha
            }
        }

        // Vertical pass
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let r = 0, g = 0, b = 0, weightSum = 0;

                for (let j = -halfSize; j <= halfSize; j++) {
                    const srcY = Math.min(height - 1, Math.max(0, y + j));
                    const srcIdx = (srcY * width + x) * 4;
                    const weight = kernel[j + halfSize];

                    r += tempBuffer[srcIdx] * weight;
                    g += tempBuffer[srcIdx + 1] * weight;
                    b += tempBuffer[srcIdx + 2] * weight;
                    weightSum += weight;
                }

                const destIdx = (y * width + x) * 4;
                result.data[destIdx] = r / weightSum;
                result.data[destIdx + 1] = g / weightSum;
                result.data[destIdx + 2] = b / weightSum;
                result.data[destIdx + 3] = imageData.data[destIdx + 3]; // Copy alpha
            }
        }

        return result;
    }

    // Generate 1D Gaussian kernel
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
        return kernel.map(value => value / sum);
    }

    // Compute difference between two images
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

    // Clone image data
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

export class ThreeJsDoGBumpMapper {
    constructor(options = {}) {
        this.dogPDA = new DoGBumpMapPDA(options);
    }

    // Process an image and create a Three.js texture
    createBumpTexture(imageUrl) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "Anonymous";

            img.onload = () => {
                console.log(`[DoGBump] Image loaded (${img.width}×${img.height}):`, img.src)
                // Create canvas and get image data
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);

                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

                // Generate bump map
                const bumpMapData = this.dogPDA.generateBumpMap(imageData);

                // Create output canvas for the bump map
                const outputCanvas = document.createElement('canvas');
                outputCanvas.width = bumpMapData.width;
                outputCanvas.height = bumpMapData.height;
                const outputCtx = outputCanvas.getContext('2d');
                outputCtx.putImageData(bumpMapData, 0, 0);
                
                // …inside createBumpTexture, right after putImageData…

                // === Preview injection ===
                outputCanvas.style.cssText = `
                position: fixed;
                bottom: 10px;
                right: 10px;
                width: 128px;
                height: 128px;
                border: 2px solid #fff;
                z-index: 9999;
                `;
                document.body.appendChild(outputCanvas);

                // === Quick flat‑check log ===
                const raw = bumpMapData.data; // Uint8ClampedArray
                // grab the first 16 pixels’ gray values (every 4th byte)
                const sample = [];
                for (let i = 0; i < 16*4; i += 4) {
                sample.push(raw[i]);
                }
                console.log("[DoGBump] bumpMap sample values:", sample);

                // === Data‑URL conversion & preview img ===
                const dataURL = outputCanvas.toDataURL();
                console.log("[DoGBump] bumpMap data URL:", dataURL);

                const previewImg = document.createElement('img');
                previewImg.src = dataURL;
                previewImg.style.cssText = `
                position: fixed;
                bottom: 10px;
                left: 10px;
                width: 128px;
                border: 2px solid #fff;
                z-index: 9999;
                `;
                document.body.appendChild(previewImg);


                // Create Three.js texture from bump map
                const texture = new THREE.Texture(outputCanvas);
                texture.needsUpdate = true;

                resolve(texture);
            };

            img.onerror = () => {
                console.error(`[DoGBump] Failed to load image: ${img.src}`);
                reject(new Error('Failed to load image'));
            };

            img.src = imageUrl;
        });
    }

    // Static method to apply bump map to a mesh
    static async applyToMesh(mesh, imageUrl, options = {}) {
        const mapper = new ThreeJsDoGBumpMapper(options);
        try {
            const bumpTexture = await mapper.createBumpTexture(imageUrl);

            // Apply as bump map to material
            if (mesh.material) {
                mesh.material.bumpMap = bumpTexture;
                mesh.material.bumpScale = options.bumpScale || 0.1;
                mesh.material.needsUpdate = true;
            }

            return bumpTexture;
        } catch (error) {
            console.error('Error applying bump map:', error);
            throw error;
        }
    }
}