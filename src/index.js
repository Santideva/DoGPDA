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


/**
 * Switches the mesh material to show only the requested mapType.
 * Must sit before applyMaps so it’s in scope.
 */
function setVisualizationMode(mode) {
    const mat = plane.material;
    const tex = stateManager.getState().textures;
  
    // Clear all channels
    mat.normalMap    = null;
    mat.map          = null;
    mat.emissiveMap  = null;
    mat.emissive.set(0x000000);
    mat.emissiveIntensity = 0;
  
    // Activate only the chosen one:
    if (mode === 'bump' && tex.bumpTexture) {
      mat.map = tex.bumpTexture;
    } else if (mode === 'normal' && tex.normalTexture) {
      mat.map = tex.normalTexture;
    } else if (mode === 'albedo' && tex.albedoTexture) {
      mat.map = tex.albedoTexture;
    } else if (mode === 'emission' && tex.emissionTexture) {
        const opts = stateManager.getState().emissionOptions;
        mat.emissiveMap       = tex.emissionTexture;
        mat.emissive.copy( new THREE.Color(opts.color) );
        mat.emissiveIntensity = opts.intensity;
      }
  
    mat.needsUpdate = true;
  }
  

// Combined applyMaps
/**
 * @param {'bump'|'normal'|'albedo'|'emission'} mapType
 */
async function applyMaps(mapType = 'bump') {
    console.trace('[applyMaps] entry', mapType, stateManager.getState().flags);
    const state = stateManager.getState();
    
    // guard re-entrancy as before…
    if (state.flags.processingInProgress) {
      stateManager.updateState({ flags:{ pendingUpdate:true } });
      return;
    }
    stateManager.updateState({ flags:{ processingInProgress:true } });
    userInterface.showLoadingIndicator(true);
  
    try {
      let bumpTexture, normalTexture, albedoTexture, emissionTexture;
  
      switch (mapType) {
        case 'bump':
          bumpTexture = await applyBumpMap();
          break;
  
        case 'normal':
          bumpTexture = await applyBumpMap();
          normalTexture = await applyNormalMap(bumpTexture);
          break;
  
        case 'albedo':
          albedoTexture = await applyAlbedoMap();
          break;
  
        case 'emission':
          emissionTexture = await applyEmissionMap();
          break;
  
        default:
          console.warn(`Unknown mapType: ${mapType}`);
          bumpTexture = await applyBumpMap();
      }
  
      // Finally, show only the selected map
      setVisualizationMode(mapType);

        // Tell the UI to re-inspect state.textures and update its Download button
        userInterface.updateDownloadButton(mapType);      
  
    } catch (error) {
      console.error("Error in applyMaps:", error);
    } finally {
      // reset flags & spinner as before…
      stateManager.updateState({ flags:{ processingInProgress:false } });
      userInterface.showLoadingIndicator(false);

        // Even if we run into an error, download should reflect the current state
        const currentType = mapType;
        userInterface.updateDownloadButton(currentType);

      if (stateManager.getState().flags.pendingUpdate) {
        stateManager.updateState({ flags:{ pendingUpdate:false } });
        setTimeout(() => applyMaps(mapType.value), 50);
      }
    }
  }
  

const debouncedApplyMaps = debounce(applyMaps, 300);

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
        }
    });
    
    // Subscribe to state changes
    stateManager.subscribe((changes, state) => {
        // Auto-save state changes
        stateManager.saveToLocalStorage();
    });

    // determine initial selection from the dropdown
    const initialType = document.getElementById('mapType').value || 'bump';
    userInterface.showLoadingIndicator(true);
    setTimeout(() => {
      applyMaps(initialType)
        .finally(() => {
          // hide spinner _then_ enable/disable Download button
          userInterface.showLoadingIndicator(false);
          userInterface.updateDownloadButton(initialType);
        });
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