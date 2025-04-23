import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ThreeJsDoGBumpMapper } from './js/DoGBumpMapper.js';
import { ThreeJsBumpToNormalMapper } from './js/BumpToNormalMapper.js';
import { ThreeJsAlbedoMapper } from './js/albedoMapper.js';
import { ThreeJsEmissionMapper } from './js/emissionMapper.js';
import { StateManager } from './stateManager.js';
import { UserInterface } from './userInterface.js';
import './css/styles.css';

// Global variables
let scene, camera, renderer, controls;
let plane;
let stateManager;
let userInterface;
let clock;
let frameCount = 0;

// Debounce helper
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}

// Apply bump map
async function applyBumpMap() {
    const state = stateManager.getState();
    const bumpOptions = state.bumpOptions;
    const imageUrl = state.resources.imageUrl;
    
    console.groupCollapsed("%c[BumpMap] Applying new bump map", "color: teal; font-weight:bold");
    console.log("Options:", Object.assign({}, bumpOptions));
    console.log("Source image URL:", imageUrl);

    const currentBumpTexture = state.textures.bumpTexture;
    if (currentBumpTexture) {
        console.log("Disposing previous texture");
        currentBumpTexture.dispose();
    }

    const start = performance.now();
    try {
        if (!imageUrl) throw new Error("No image URL provided");
        const bumpTexture = await ThreeJsDoGBumpMapper.applyToMesh(plane, imageUrl, bumpOptions);
        const elapsed = (performance.now() - start).toFixed(1);
        if (!bumpTexture || !bumpTexture.image) throw new Error("Failed to create bump texture");
        const w = bumpTexture.image.width, h = bumpTexture.image.height;
        console.log(`Texture size: ${w}×${h}`);
        console.log(`Bump scale: ${bumpOptions.bumpScale}`);
        console.log(`⏱️ Completed in ${elapsed}ms`);
        console.log("%c[BumpMap] Success ✅", "color: green;");
        
        // Update texture in state
        stateManager.updateState({
            textures: { bumpTexture }
        });
        
        return bumpTexture;
    } catch (error) {
        console.error("%c[BumpMap] Failed ❌", "color: red; font-weight:bold", error);
        userInterface.showErrorMessage(`Failed to create bump map: ${error.message}`);
        throw error;
    } finally {
        console.groupEnd();
    }
}

// Apply normal map
async function applyNormalMap(bumpTexture) {
    const state = stateManager.getState();
    const normalOptions = state.normalOptions;
    
    console.groupCollapsed("%c[NormalMap] Applying new normal map", "color: purple; font-weight:bold");
    console.log("Options:", Object.assign({}, normalOptions));

    const currentNormalTexture = state.textures.normalTexture;
    if (currentNormalTexture) {
        console.log("Disposing previous normal texture");
        currentNormalTexture.dispose();
    }

    const start = performance.now();
    try {
        if (!bumpTexture || !bumpTexture.image) throw new Error("Invalid bump texture provided");
        const normalTexture = await ThreeJsBumpToNormalMapper.applyToMesh(plane, bumpTexture, normalOptions);
        const elapsed = (performance.now() - start).toFixed(1);
        if (!normalTexture || !normalTexture.image) throw new Error("Failed to create normal texture");
        const w = normalTexture.image.width, h = normalTexture.image.height;
        console.log(`Normal texture size: ${w}×${h}`);
        console.log(`Normal scale: ${normalOptions.normalScale}`);
        console.log(`⏱️ Completed in ${elapsed}ms`);
        console.log("%c[NormalMap] Success ✅", "color: green;");
        
        // Update texture in state
        stateManager.updateState({
            textures: { normalTexture }
        });
        
        // Apply normal map to material if enabled
        if (plane && plane.material) {
            plane.material.normalMap = state.flags.useNormalMap ? normalTexture : null;
            plane.material.needsUpdate = true;
        }
        
        return normalTexture;
    } catch (error) {
        console.error("%c[NormalMap] Failed ❌", "color: red; font-weight:bold", error);
        userInterface.showErrorMessage(`Failed to create normal map: ${error.message}`);
        throw error;
    } finally {
        console.groupEnd();
    }
}

// Apply albedo map
async function applyAlbedoMap() {
    const state = stateManager.getState();
    const albedoOptions = state.albedoOptions;
    const imageUrl = state.resources.imageUrl;
    
    console.groupCollapsed("%c[AlbedoMap] Applying new albedo map", "color: teal; font-weight:bold");
    console.log("Options:", Object.assign({}, albedoOptions));

    const currentAlbedoTexture = state.textures.albedoTexture;
    if (currentAlbedoTexture) {
        console.log("Disposing previous albedo texture");
        currentAlbedoTexture.dispose();
    }

    const start = performance.now();
    try {
        if (!imageUrl) throw new Error("No image URL provided");
        const albedoTexture = await ThreeJsAlbedoMapper.applyToMesh(plane, imageUrl, albedoOptions);
        const elapsed = (performance.now() - start).toFixed(1);
        if (!albedoTexture || !albedoTexture.image) throw new Error("Failed to create albedo texture");
        const w = albedoTexture.image.width, h = albedoTexture.image.height;
        console.log(`Albedo texture size: ${w}×${h}`);
        console.log(`⏱️ Completed in ${elapsed}ms`);
        console.log("%c[AlbedoMap] Success ✅", "color: green;");
        
        // Update texture in state
        stateManager.updateState({
            textures: { albedoTexture }
        });
        
        return albedoTexture;
    } catch (error) {
        console.error("%c[AlbedoMap] Failed ❌", "color: red; font-weight:bold", error);
        userInterface.showErrorMessage(`Failed to create albedo map: ${error.message}`);
        throw error;
    } finally {
        console.groupEnd();
    }
}

// Apply emission map
async function applyEmissionMap() {
    const state = stateManager.getState();
    const emissionOptions = state.emissionOptions;
    const imageUrl = state.resources.imageUrl;
    
    console.groupCollapsed("%c[EmissionMap] Applying new emission map", "color: orange; font-weight:bold");
    console.log("Options:", Object.assign({}, emissionOptions));

    const currentEmissionTexture = state.textures.emissionTexture;
    if (currentEmissionTexture) {
        console.log("Disposing previous emission texture");
        currentEmissionTexture.dispose();
    }

    const start = performance.now();
    try {
        if (!imageUrl) throw new Error("No image URL provided");
        const emissionTexture = await ThreeJsEmissionMapper.applyToMesh(plane, imageUrl, emissionOptions);
        const elapsed = (performance.now() - start).toFixed(1);
        if (!emissionTexture || !emissionTexture.image) throw new Error("Failed to create emission texture");
        const w = emissionTexture.image.width, h = emissionTexture.image.height;
        console.log(`Emission texture size: ${w}×${h}`);
        console.log(`⏱️ Completed in ${elapsed}ms`);
        console.log("%c[EmissionMap] Success ✅", "color: green;");
        
        // Update texture in state
        stateManager.updateState({
            textures: { emissionTexture }
        });
        
        return emissionTexture;
    } catch (error) {
        console.error("%c[EmissionMap] Failed ❌", "color: red; font-weight:bold", error);
        userInterface.showErrorMessage(`Failed to create emission map: ${error.message}`);
        throw error;
    } finally {
        console.groupEnd();
    }
}

// Combined applyMaps
async function applyMaps() {
    const state = stateManager.getState();
    
    // Check if processing is already in progress
    if (state.flags.processingInProgress) {
        stateManager.updateState({
            flags: { pendingUpdate: true }
        });
        return;
    }
    
    stateManager.updateState({
        flags: { processingInProgress: true }
    });
    userInterface.showLoadingIndicator(true);

    try {
        const bumpTexture = await applyBumpMap();
        
        if (state.flags.useNormalMap) {
            await applyNormalMap(bumpTexture);
        } else if (plane && plane.material) {
            plane.material.normalMap = null;
            plane.material.needsUpdate = true;
        }
        
        if (state.flags.useAlbedoMap) {
            const albedoTexture = await applyAlbedoMap();
            if (plane && plane.material) {
                plane.material.map = albedoTexture;
                plane.material.needsUpdate = true;
            }
        } else if (plane && plane.material) {
            if (plane.material.map) {
                plane.material.map.dispose();
            }
            plane.material.map = null;
            plane.material.needsUpdate = true;
        }
        
        if (state.flags.useEmissionMap) {
            const emissionTexture = await applyEmissionMap();
            if (plane && plane.material) {
                plane.material.emissiveMap = emissionTexture;
                plane.material.emissive.set(new THREE.Color(state.emissionOptions.color));
                plane.material.emissiveIntensity = state.emissionOptions.intensity;
                plane.material.needsUpdate = true;
            }
        } else if (plane && plane.material) {
            if (plane.material.emissiveMap) {
                plane.material.emissiveMap.dispose();
            }
            plane.material.emissiveMap = null;
            plane.material.emissive.set(0x000000);
            plane.material.emissiveIntensity = 0;
            plane.material.needsUpdate = true;
        }
        
        // Reapply the current visualization mode
        const visMode = state.visualization.activeMap;
        setVisualizationMode(visMode);
    } catch (error) {
        console.error("Error applying maps:", error);
    } finally {
        const updatedState = stateManager.getState();
        stateManager.updateState({
            flags: { 
                processingInProgress: false 
            }
        });
        userInterface.showLoadingIndicator(false);
        
        if (updatedState.flags.pendingUpdate) {
            stateManager.updateState({
                flags: { pendingUpdate: false }
            });
            setTimeout(applyMaps, 50);
        }
    }
}

const debouncedApplyMaps = debounce(applyMaps, 300);

// Switching visualization mode
function setVisualizationMode(mode) {
    console.log(`Switching visualization mode to: ${mode}`);
    
    // Save current material settings to restore later
    const currentMaterial = plane.material;
    const savedSettings = {
        normalMap: currentMaterial.normalMap,
        map: currentMaterial.map,
        emissiveMap: currentMaterial.emissiveMap,
        emissive: currentMaterial.emissive.clone(),
        emissiveIntensity: currentMaterial.emissiveIntensity,
        normalScale: currentMaterial.normalScale.clone()
    };
    
    // Get textures from state
    const state = stateManager.getState();
    const textures = state.textures;
    
    // Reset material to default view
    if (mode === 'material') {
        // Apply saved settings
        currentMaterial.normalMap = state.flags.useNormalMap ? textures.normalTexture : null;
        currentMaterial.map = state.flags.useAlbedoMap ? textures.albedoTexture : null;
        currentMaterial.emissiveMap = state.flags.useEmissionMap ? textures.emissionTexture : null;
        currentMaterial.emissive.copy(savedSettings.emissive);
        currentMaterial.emissiveIntensity = savedSettings.emissiveIntensity;
        currentMaterial.normalScale.copy(savedSettings.normalScale);
    } 
    // Show only the bumped surface with grayscale
    else if (mode === 'bump') {
        // Create a basic material that shows just the bump texture
        if (textures.bumpTexture) {
            currentMaterial.normalMap = null;
            currentMaterial.map = textures.bumpTexture; // Use bump as albedo to view it
            currentMaterial.emissiveMap = null;
            currentMaterial.emissive.set(0x000000);
            currentMaterial.emissiveIntensity = 0;
        }
    }
    // Show only the normal map
    else if (mode === 'normal') {
        if (textures.normalTexture) {
            currentMaterial.normalMap = null;
            currentMaterial.map = textures.normalTexture; // Use normal as albedo to view it
            currentMaterial.emissiveMap = null; 
            currentMaterial.emissive.set(0x000000);
            currentMaterial.emissiveIntensity = 0;
        }
    }
    // Show only the albedo map
    else if (mode === 'albedo') {
        if (textures.albedoTexture) {
            currentMaterial.normalMap = null;
            currentMaterial.map = textures.albedoTexture;
            currentMaterial.emissiveMap = null;
            currentMaterial.emissive.set(0x000000);
            currentMaterial.emissiveIntensity = 0;
        }
    }
    // Show only the emission map
    else if (mode === 'emission') {
        if (textures.emissionTexture) {
            currentMaterial.normalMap = null;
            currentMaterial.map = null;
            currentMaterial.emissiveMap = textures.emissionTexture;
            currentMaterial.emissive.set(0xffffff); // Full white for emission viewing
            currentMaterial.emissiveIntensity = 1.0;
        }
    }
    
    currentMaterial.needsUpdate = true;
    
    // Update control panel visibility
    updateControlVisibility(mode);
}

// Handle control panel visibility
function updateControlVisibility(mode) {
    // Map of control panels by visualization mode
    const panelIdMap = {
        'material': null, // No specific panel for material view
        'bump': 'controls',
        'normal': 'normal-controls',
        'albedo': 'albedo-controls',
        'emission': 'emission-controls'
    };
    
    // Get all map panels
    const mapPanels = document.querySelectorAll('.map-panel');
    
    // Hide all panels first
    mapPanels.forEach(panel => {
        panel.classList.remove('active');
    });
    
    // Show only the selected panel
    const activePanelId = panelIdMap[mode];
    if (activePanelId) {
        const activePanel = document.getElementById(activePanelId);
        if (activePanel) {
            activePanel.classList.add('active');
        }
    }
}

// Initialize the scene
function init() {
    // Initialize state manager with default settings
    stateManager = new StateManager({
        resources: {
            imageUrl: new URL('./assets/textures/nebula.jpg', import.meta.url).href
        }
    });
    
    // Try to load saved state
    stateManager.loadFromLocalStorage();
    
    // Initialize scene
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
    
    // Initialize UI with callbacks
    userInterface = new UserInterface(stateManager, {
        applyMaps: applyMaps,
        debouncedApplyMaps: debouncedApplyMaps,
        updateNormalScale: (scale) => {
            if (plane?.material?.normalMap) {
                plane.material.normalScale.set(scale, scale);
                plane.material.needsUpdate = true;
            }
        },
        updateEmissiveIntensity: (intensity) => {
            if (plane?.material?.emissiveMap) {
                plane.material.emissiveIntensity = intensity;
                plane.material.needsUpdate = true;
            }
        },
        updateEmissiveColor: (color) => {
            if (plane?.material?.emissiveMap) {
                plane.material.emissive.set(color);
                plane.material.needsUpdate = true;
            }
        },
        toggleNormalMap: (enabled) => {
            if (plane?.material) {
                const state = stateManager.getState();
                plane.material.normalMap = enabled ? state.textures.normalTexture : null;
                plane.material.needsUpdate = true;
            }
        },
        toggleAlbedoMap: (enabled) => {
            if (plane?.material) {
                const state = stateManager.getState();
                plane.material.map = enabled ? state.textures.albedoTexture : null;
                plane.material.needsUpdate = true;
            }
        },
        toggleEmissionMap: (enabled) => {
            if (plane?.material) {
                const state = stateManager.getState();
                plane.material.emissiveMap = enabled ? state.textures.emissionTexture : null;
                plane.material.emissive.set(enabled ? new THREE.Color(state.emissionOptions.color) : new THREE.Color(0x000000));
                plane.material.emissiveIntensity = enabled ? state.emissionOptions.intensity : 0;
                plane.material.needsUpdate = true;
            }
        },
        // Add new callback for visualization mode
        setVisualizationMode: setVisualizationMode
    });
    
    // Subscribe to state changes
    stateManager.subscribe((changes, state) => {
        // Auto-save state changes
        stateManager.saveToLocalStorage();
    });

    userInterface.showLoadingIndicator(true);
    setTimeout(() => {
        applyMaps().finally(() => userInterface.showLoadingIndicator(false));
    }, 100);
    
    // Initialize clock for animations
    clock = new THREE.Clock();

    animate();
}

// Window resize handler
const debouncedResize = debounce(() => {
    if (!camera || !renderer) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}, 200);

function onWindowResize() { 
    debouncedResize(); 
}

// Cleanup
function cleanupResources() {
    const state = stateManager.getState();
    
    // Clean up textures
    if (state.textures.bumpTexture) state.textures.bumpTexture.dispose();
    if (state.textures.normalTexture) state.textures.normalTexture.dispose();
    if (state.textures.albedoTexture) state.textures.albedoTexture.dispose();
    if (state.textures.emissionTexture) state.textures.emissionTexture.dispose();
    
    // Clean up image URL if it's a blob
    const imageUrl = state.resources.imageUrl;
    if (typeof imageUrl === 'string' && imageUrl.startsWith('blob:')) {
        URL.revokeObjectURL(imageUrl);
    }
    
    // Clean up mesh
    if (plane) {
        if (plane.geometry) plane.geometry.dispose();
        if (plane.material) plane.material.dispose();
    }
    
    // Clean up renderer
    if (renderer) renderer.dispose();
}

window.addEventListener('beforeunload', cleanupResources);

// Animation loop
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