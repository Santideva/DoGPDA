// BumpToNormalMapper.js
import * as THREE from 'three';

export class BumpToNormalPDA {
    constructor(options = {}) {
        // Configuration parameters
        this.strength = options.strength || 1.0;  // Normal map intensity
        
        // PDA states
        this.states = {
            INIT: 'init',
            SCAN: 'scan',
            COMPLEX_GRAD: 'complex_grad',
            VECTOR_MAP: 'vector_map',
            NORMALIZE: 'normalize',
            ENCODE: 'encode',
            ACCEPT: 'accept'
        };
        
        // Initialize state and stack
        this.currentState = this.states.INIT;
        this.stack = [];
        
        // Result image data
        this.normalMap = null;
    }
    
    // Entry point: takes bump ImageData, returns normal ImageData
    generateNormalMap(bumpMapData) {
        console.log("[BumpToNormal] Starting normal map generation");
        // Push bump data into PDA stack
        this.stack.push({ type: 'bump', data: this._cloneImageData(bumpMapData) });
        this.currentState = this.states.SCAN;
        
        // Drive PDA transitions until ACCEPT
        while (this.currentState !== this.states.ACCEPT) {
            this._transition();
        }
        
        return this.normalMap;
    }
    
    // PDA state machine
    _transition() {
        switch (this.currentState) {
            case this.states.SCAN:
                this.currentState = this.states.COMPLEX_GRAD;
                this._computeComplexGradients();
                break;
            case this.states.COMPLEX_GRAD:
                this.currentState = this.states.VECTOR_MAP;
                this._mapToVectorField();
                break;
            case this.states.VECTOR_MAP:
                this.currentState = this.states.NORMALIZE;
                this._normalizeVectors();
                break;
            case this.states.NORMALIZE:
                this.currentState = this.states.ENCODE;
                this._encodeAsRGB();
                break;
            case this.states.ENCODE:
                this.currentState = this.states.ACCEPT;
                break;
        }
    }
    
    // Compute gradients dx, dy from bump heights
    _computeComplexGradients() {
        const bumpMap = this.stack[0].data;
        const width = bumpMap.width;
        const height = bumpMap.height;
        console.log(`[BumpToNormal] Computing complex gradients for ${width}×${height}`);
        
        const gradients = new Float32Array(width * height * 2);
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                const h = bumpMap.data[idx] / 255.0;
                const left   = x > 0 ? bumpMap.data[idx - 4] / 255.0 : h;
                const right  = x < width - 1 ? bumpMap.data[idx + 4] / 255.0 : h;
                const top    = y > 0 ? bumpMap.data[(y - 1) * width * 4 + x * 4] / 255.0 : h;
                const bottom = y < height - 1 ? bumpMap.data[(y + 1) * width * 4 + x * 4] / 255.0 : h;
                const dx = (right - left) * 0.5 * this.strength;
                const dy = (bottom - top) * 0.5 * this.strength;
                gradients[(y * width + x) * 2]     = dx;
                gradients[(y * width + x) * 2 + 1] = dy;
            }
        }
        this.stack.push({ type: 'gradients', data: gradients, width, height });
    }
    
    // Map each gradient to 3D vector
    _mapToVectorField() {
        const { data: gradients, width, height } = this.stack.pop();
        console.log("[BumpToNormal] Mapping gradients to vector field");

        const vectors = new Float32Array(width * height * 3);
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const gi = (y * width + x) * 2;
                const vx = gradients[gi];
                const vy = gradients[gi + 1];
                const vz = 1.0; // assume z upward
                const len = Math.sqrt(vx*vx + vy*vy + vz*vz);
                const idx = (y * width + x) * 3;
                vectors[idx]     = vx / len;
                vectors[idx + 1] = vy / len;
                vectors[idx + 2] = vz / len;
            }
        }
        this.stack.push({ type: 'vectors', data: vectors, width, height });
    }
    
    // Normalize vector field (unit vectors)
    _normalizeVectors() {
        const { data: vectors, width, height } = this.stack.pop();
        console.log("[BumpToNormal] Normalizing vectors");
        for (let i = 0; i < vectors.length; i += 3) {
            const x = vectors[i], y = vectors[i+1], z = vectors[i+2];
            const len = Math.sqrt(x*x + y*y + z*z) || 1.0;
            vectors[i]     = x / len;
            vectors[i + 1] = y / len;
            vectors[i + 2] = z / len;
        }
        this.stack.push({ type: 'normalized', data: vectors, width, height });
    }
    
    // Encode normals as RGB ImageData
    _encodeAsRGB() {
        const { data: vectors, width, height } = this.stack.pop();
        console.log("[BumpToNormal] Encoding normals as RGB");
        this.normalMap = new ImageData(width, height);
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const vi = (y * width + x) * 3;
                const ni = (y * width + x) * 4;
                this.normalMap.data[ni]     = Math.floor((vectors[vi]   * 0.5 + 0.5) * 255);
                this.normalMap.data[ni + 1] = Math.floor((vectors[vi+1] * 0.5 + 0.5) * 255);
                this.normalMap.data[ni + 2] = Math.floor((vectors[vi+2] * 0.5 + 0.5) * 255);
                this.normalMap.data[ni + 3] = 255;
            }
        }
    }
    
    // Deep clone ImageData
    _cloneImageData(imageData) {
        return new ImageData(
            new Uint8ClampedArray(imageData.data),
            imageData.width,
            imageData.height
        );
    }
}

// Three.js integration
export class ThreeJsBumpToNormalMapper {
    constructor(options = {}) {
        this.normalPDA = new BumpToNormalPDA(options);
    }

    /**
     * Takes bump ImageData, creates a preview canvas and Three.js texture
     */
    createNormalMapFromBump(bumpImageData) {
        console.groupCollapsed("%c[BumpToNormal] Converting bump map to normal map", "color: blue; font-weight:bold");
        const start = performance.now();

        // Generate normal map ImageData
        const normalMapData = this.normalPDA.generateNormalMap(bumpImageData);

        // Draw result to an output canvas
        const outputCanvas = document.createElement('canvas');
        outputCanvas.width = normalMapData.width;
        outputCanvas.height = normalMapData.height;
        const ctx = outputCanvas.getContext('2d');
        ctx.putImageData(normalMapData, 0, 0);

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

        // Create Three.js texture
        const normalTexture = new THREE.Texture(outputCanvas);
        normalTexture.needsUpdate = true;
        normalTexture.wrapS = THREE.RepeatWrapping;
        normalTexture.wrapT = THREE.RepeatWrapping;

        const elapsed = (performance.now() - start).toFixed(1);
        console.log(`⏱️ Completed in ${elapsed}ms`);
        console.log("%c[BumpToNormal] Success ✅", "color: green;");
        console.groupEnd();

        return normalTexture;
    }

    /**
     * Static: takes a bump Texture, extracts ImageData, returns normal Texture
     */
    static createNormalMap(bumpTexture, options = {}) {
        return new Promise((resolve, reject) => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = bumpTexture.image.width || bumpTexture.image.naturalWidth;
                canvas.height = bumpTexture.image.height || bumpTexture.image.naturalHeight;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(bumpTexture.image, 0, 0);
                const bumpData = ctx.getImageData(0, 0, canvas.width, canvas.height);

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
     */
    static async applyToMesh(mesh, bumpTexture, options = {}) {
        const normalTexture = await ThreeJsBumpToNormalMapper.createNormalMap(bumpTexture, options);
        if (mesh.material) {
            mesh.material.normalMap = normalTexture;
            mesh.material.normalScale = new THREE.Vector2(
                options.normalScale || 1.0,
                options.normalScale || 1.0
            );
            mesh.material.needsUpdate = true;
        }
        return normalTexture;
    }
}
