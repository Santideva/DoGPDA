import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ThreeJsDoGBumpMapper } from './js/DoGBumpMapper.js';
import { ThreeJsBumpToNormalMapper } from './js/BumpToNormalMapper.js';
import { ThreeJsAlbedoMapper } from './js/albedoMapper.js';
import './css/styles.css';

// Global variables
let scene, camera, renderer, controls;
let plane, currentTexture, currentBumpTexture, currentNormalTexture, currentAlbedoTexture;
let currentBumpOptions = {
    sigma1: 1.0,
    sigma2: 2.0,
    heightScale: 1.0,
    bumpScale: 0.1,
    threshold: 0.1
};
let currentNormalOptions = {
    strength: 1.0,
    normalScale: 1.0
};
let currentAlbedoOptions = {
    brightness: 1.0,
    contrast:   1.0,
    saturation: 1.0
};
let useNormalMap = true;   // Generate normal maps by default
let useAlbedoMap  = true;  // Generate albedo maps by default
let processingInProgress = false;
let pendingUpdate       = false;

// Sample image URL
let imageUrl = new URL('./assets/textures/nebula.jpg', import.meta.url).href;

// Debounce helper
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}

// File input handler
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
    }
    const newImageUrl = URL.createObjectURL(file);
    console.log("Loading image from file:", file.name);
    if (typeof imageUrl === 'string' && imageUrl.startsWith('blob:')) {
        URL.revokeObjectURL(imageUrl);
    }
    imageUrl = newImageUrl;
    updateImagePreview();
    applyMaps();
}

// Update preview div
function updateImagePreview() {
    const preview = document.getElementById('image-preview');
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

// Initialize the scene
function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x333333);
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 5;

    try {
        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        document.body.appendChild(renderer.domElement);
    } catch (error) {
        console.error("Failed to initialize WebGL renderer:", error);
        const errorMsg = document.createElement('div');
        errorMsg.style.color = 'red';
        errorMsg.style.padding = '20px';
        errorMsg.textContent = 'WebGL initialization failed. Please check if your browser supports WebGL.';
        document.body.appendChild(errorMsg);
        return;
    }

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    const ambientLight = new THREE.AmbientLight(0x404040);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(1, 1, 1);
    scene.add(directionalLight);
    const pointLight = new THREE.PointLight(0xffffff, 0.5);
    camera.add(pointLight);
    scene.add(camera);

    const geometry = new THREE.PlaneGeometry(4, 4, 32, 32);
    const material = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        metalness: 0.1,
        roughness: 0.8,
        side: THREE.DoubleSide
    });
    plane = new THREE.Mesh(geometry, material);
    scene.add(plane);

    window.addEventListener('resize', onWindowResize);
    setupControls();

    showLoadingIndicator(true);
    setTimeout(() => {
        applyMaps().finally(() => showLoadingIndicator(false));
    }, 100);

    animate();
}

// Loading indicator
function showLoadingIndicator(show) {
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

// Apply bump map
async function applyBumpMap() {
    console.groupCollapsed("%c[BumpMap] Applying new bump map", "color: teal; font-weight:bold");
    console.log("Options:", Object.assign({}, currentBumpOptions));
    console.log("Source image URL:", imageUrl);

    if (currentBumpTexture) {
        console.log("Disposing previous texture");
        currentBumpTexture.dispose();
    }

    const start = performance.now();
    try {
        if (!imageUrl) throw new Error("No image URL provided");
        currentBumpTexture = await ThreeJsDoGBumpMapper.applyToMesh(plane, imageUrl, currentBumpOptions);
        const elapsed = (performance.now() - start).toFixed(1);
        if (!currentBumpTexture || !currentBumpTexture.image) throw new Error("Failed to create bump texture");
        const w = currentBumpTexture.image.width, h = currentBumpTexture.image.height;
        console.log(`Texture size: ${w}×${h}`);
        console.log(`Bump scale: ${currentBumpOptions.bumpScale}`);
        console.log(`⏱️ Completed in ${elapsed}ms`);
        console.log("%c[BumpMap] Success ✅", "color: green;");
        return currentBumpTexture;
    } catch (error) {
        console.error("%c[BumpMap] Failed ❌", "color: red; font-weight:bold", error);
        showErrorMessage(`Failed to create bump map: ${error.message}`);
        throw error;
    } finally {
        console.groupEnd();
    }
}

// Apply normal map
async function applyNormalMap(bumpTexture) {
    console.groupCollapsed("%c[NormalMap] Applying new normal map", "color: purple; font-weight:bold");
    console.log("Options:", Object.assign({}, currentNormalOptions));

    if (currentNormalTexture) {
        console.log("Disposing previous normal texture");
        currentNormalTexture.dispose();
    }

    const start = performance.now();
    try {
        if (!bumpTexture || !bumpTexture.image) throw new Error("Invalid bump texture provided");
        currentNormalTexture = await ThreeJsBumpToNormalMapper.applyToMesh(plane, bumpTexture, currentNormalOptions);
        const elapsed = (performance.now() - start).toFixed(1);
        if (!currentNormalTexture || !currentNormalTexture.image) throw new Error("Failed to create normal texture");
        const w = currentNormalTexture.image.width, h = currentNormalTexture.image.height;
        console.log(`Normal texture size: ${w}×${h}`);
        console.log(`Normal scale: ${currentNormalOptions.normalScale}`);
        console.log(`⏱️ Completed in ${elapsed}ms`);
        console.log("%c[NormalMap] Success ✅", "color: green;");
        if (plane && plane.material) {
            plane.material.normalMap = useNormalMap ? currentNormalTexture : null;
            plane.material.needsUpdate = true;
        }
        return currentNormalTexture;
    } catch (error) {
        console.error("%c[NormalMap] Failed ❌", "color: red; font-weight:bold", error);
        showErrorMessage(`Failed to create normal map: ${error.message}`);
        throw error;
    } finally {
        console.groupEnd();
    }
}

// Apply albedo map
async function applyAlbedoMap() {
    console.groupCollapsed("%c[AlbedoMap] Applying new albedo map", "color: teal; font-weight:bold");
    console.log("Options:", Object.assign({}, currentAlbedoOptions));

    if (currentAlbedoTexture) {
        console.log("Disposing previous albedo texture");
        currentAlbedoTexture.dispose();
    }

    const start = performance.now();
    try {
        if (!imageUrl) throw new Error("No image URL provided");
        currentAlbedoTexture = await ThreeJsAlbedoMapper.applyToMesh(plane, imageUrl, currentAlbedoOptions);
        const elapsed = (performance.now() - start).toFixed(1);
        if (!currentAlbedoTexture || !currentAlbedoTexture.image) throw new Error("Failed to create albedo texture");
        const w = currentAlbedoTexture.image.width, h = currentAlbedoTexture.image.height;
        console.log(`Albedo texture size: ${w}×${h}`);
        console.log(`⏱️ Completed in ${elapsed}ms`);
        console.log("%c[AlbedoMap] Success ✅", "color: green;");
        return currentAlbedoTexture;
    } catch (error) {
        console.error("%c[AlbedoMap] Failed ❌", "color: red; font-weight:bold", error);
        showErrorMessage(`Failed to create albedo map: ${error.message}`);
        throw error;
    } finally {
        console.groupEnd();
    }
}

// Combined applyMaps
async function applyMaps() {
    if (processingInProgress) { pendingUpdate = true; return; }
    processingInProgress = true;
    showLoadingIndicator(true);

    try {
        const bumpTexture = await applyBumpMap();
        if (useNormalMap) {
            await applyNormalMap(bumpTexture);
        } else if (plane && plane.material) {
            plane.material.normalMap = null;
            plane.material.needsUpdate = true;
        }
        if (useAlbedoMap) {
            await applyAlbedoMap();
        } else if (plane && plane.material) {
            if (plane.material.map) {
                plane.material.map.dispose();
            }
            plane.material.map = null;
            plane.material.needsUpdate = true;
        }
    } catch (error) {
        console.error("Error applying maps:", error);
    } finally {
        processingInProgress = false;
        showLoadingIndicator(false);
        if (pendingUpdate) {
            pendingUpdate = false;
            setTimeout(applyMaps, 50);
        }
    }
}

const debouncedApplyMaps = debounce(applyMaps, 300);

// Set up UI controls
function setupControls() {
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

    function safeSetSliderValue(slider, valueDisplay, value) {
        if (slider && valueDisplay) {
            const v = parseFloat(value) || 0;
            slider.value = v;
            valueDisplay.textContent = v;
        }
    }

    safeSetSliderValue(sigma1Slider, sigma1Value, currentBumpOptions.sigma1);
    safeSetSliderValue(sigma2Slider, sigma2Value, currentBumpOptions.sigma2);
    safeSetSliderValue(heightScaleSlider, heightScaleValue, currentBumpOptions.heightScale);
    safeSetSliderValue(bumpScaleSlider, bumpScaleValue, currentBumpOptions.bumpScale);
    safeSetSliderValue(thresholdSlider, thresholdValue, currentBumpOptions.threshold);
    safeSetSliderValue(strengthSlider, strengthValue, currentNormalOptions.strength);
    safeSetSliderValue(normalScaleSlider, normalScaleValue, currentNormalOptions.normalScale);

    safeSetSliderValue(brightnessSlider, brightnessValue, currentAlbedoOptions.brightness);
    safeSetSliderValue(contrastSlider, contrastValue, currentAlbedoOptions.contrast);
    safeSetSliderValue(saturationSlider, saturationValue, currentAlbedoOptions.saturation);

    if (useNormalMapCheckbox) useNormalMapCheckbox.checked = useNormalMap;
    if (useAlbedoMapCheckbox)  useAlbedoMapCheckbox.checked  = useAlbedoMap;

    function createSliderListener(slider, valueDisplay, optionsObj, key, immediate = false) {
        if (!slider || !valueDisplay) return;
        slider.addEventListener('input', () => {
            const v = parseFloat(slider.value) || 0;
            valueDisplay.textContent = v;
            optionsObj[key] = v;
            if (immediate && key === 'normalScale' && plane?.material?.normalMap) {
                plane.material.normalScale.set(v, v);
                plane.material.needsUpdate = true;
            }
        });
        slider.addEventListener('change', () => {
            if (!immediate) debouncedApplyMaps();
        });
    }

    // Bump listeners
    createSliderListener(sigma1Slider, sigma1Value, currentBumpOptions, 'sigma1');
    createSliderListener(sigma2Slider, sigma2Value, currentBumpOptions, 'sigma2');
    createSliderListener(heightScaleSlider, heightScaleValue, currentBumpOptions, 'heightScale');
    createSliderListener(bumpScaleSlider, bumpScaleValue, currentBumpOptions, 'bumpScale');
    createSliderListener(thresholdSlider, thresholdValue, currentBumpOptions, 'threshold');

    // Normal listeners
    createSliderListener(strengthSlider, strengthValue, currentNormalOptions, 'strength');
    createSliderListener(normalScaleSlider, normalScaleValue, currentNormalOptions, 'normalScale', true);

    // Albedo listeners
    createSliderListener(brightnessSlider, brightnessValue, currentAlbedoOptions, 'brightness');
    createSliderListener(contrastSlider, contrastValue, currentAlbedoOptions, 'contrast');
    createSliderListener(saturationSlider, saturationValue, currentAlbedoOptions, 'saturation');

    if (useNormalMapCheckbox) {
        useNormalMapCheckbox.addEventListener('change', () => {
            useNormalMap = useNormalMapCheckbox.checked;
            if (plane?.material) {
                plane.material.normalMap = useNormalMap ? currentNormalTexture : null;
                plane.material.needsUpdate = true;
            }
        });
    }
    if (useAlbedoMapCheckbox) {
        useAlbedoMapCheckbox.addEventListener('change', () => {
            useAlbedoMap = useAlbedoMapCheckbox.checked;
            if (plane?.material) {
                plane.material.map = useAlbedoMap ? currentAlbedoTexture : null;
                plane.material.needsUpdate = true;
            }
        });
    }

    const applyButton = document.getElementById('applyChanges');
    if (applyButton) applyButton.addEventListener('click', applyMaps);

    const fileInput = document.getElementById('imageFile');
    if (fileInput) fileInput.addEventListener('change', handleFileSelect);

    document.addEventListener('keydown', (event) => {
        if (event.ctrlKey && event.key === 'Enter') {
            applyMaps(); event.preventDefault();
        }
    });
}

// Window resize handler
const debouncedResize = debounce(() => {
    if (!camera || !renderer) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}, 200);
function onWindowResize() { debouncedResize(); }

// Cleanup
function cleanupResources() {
    if (currentBumpTexture)   currentBumpTexture.dispose();
    if (currentNormalTexture) currentNormalTexture.dispose();
    if (currentAlbedoTexture) currentAlbedoTexture.dispose();
    if (typeof imageUrl === 'string' && imageUrl.startsWith('blob:')) {
        URL.revokeObjectURL(imageUrl);
    }
    if (plane) {
        if (plane.geometry) plane.geometry.dispose();
        if (plane.material) plane.material.dispose();
    }
    if (renderer) renderer.dispose();
}
window.addEventListener('beforeunload', cleanupResources);

// Animation loop
const clock = new THREE.Clock();
let frameCount = 0;
function animate() {
    requestAnimationFrame(animate);
    frameCount++;
    if (window.devicePixelRatio > 2 && frameCount % 2 !== 0) return;
    if (controls) controls.update();
    if (plane) {
        const delta = clock.getDelta();
        plane.rotation.y += Math.sin(Date.now()*0.0005) * 0.2 * delta;
    }
    if (renderer && scene && camera) renderer.render(scene, camera);
}

// Start
init();
