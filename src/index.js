import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ThreeJsDoGBumpMapper } from './js/DoGBumpMapper.js';
import { ThreeJsBumpToNormalMapper } from './js/BumpToNormalMapper.js';
import './css/styles.css';

// Global variables
let scene, camera, renderer, controls;
let plane, currentTexture, currentBumpTexture, currentNormalTexture;
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
let useNormalMap = true;  // By default, we'll generate normal maps

// Sample image URL
let imageUrl = new URL('./assets/textures/nebula.jpg', import.meta.url).href;

// Add this function to handle file selection
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Check if it's an image
    if (!file.type.match('image.*')) {
        alert('Please select an image file');
        return;
    }
    
    // Create a URL for the file
    const newImageUrl = URL.createObjectURL(file);

    // Log the file loading
    console.log("Loading image from file:", file.name);
    
    // Clean up previous object URL if there was one
    if (typeof imageUrl === 'string' && imageUrl.startsWith('blob:')) {
        URL.revokeObjectURL(imageUrl);
    }
    
    // Update the global imageUrl
    imageUrl = newImageUrl;
    
    // Update preview
    updateImagePreview();
    
    // Apply the new texture
    applyMaps();
}

// Function to update the image preview
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
    // Create scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x333333);
    
    // Create camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 5;
    
    // Create renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    document.body.appendChild(renderer.domElement);
    
    // Add OrbitControls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    
    // Create lighting
    const ambientLight = new THREE.AmbientLight(0x404040);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(1, 1, 1);
    scene.add(directionalLight);
    
    // Create a point light that moves with the camera
    const pointLight = new THREE.PointLight(0xffffff, 0.5);
    camera.add(pointLight);
    scene.add(camera);
    
    // Create a mesh
    const geometry = new THREE.PlaneGeometry(4, 4, 32, 32);
    const material = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        metalness: 0.1,
        roughness: 0.8,
        side: THREE.DoubleSide
    });
    
    plane = new THREE.Mesh(geometry, material);
    scene.add(plane);
    
    // Apply initial bump and normal maps
    applyMaps();
    
    // Set up event listeners
    window.addEventListener('resize', onWindowResize);
    setupControls();
    
    // Start animation loop
    animate();
}

// Apply the bump map with current options
async function applyBumpMap() {
    console.groupCollapsed("%c[BumpMap] Applying new bump map", "color: teal; font-weight:bold");
    console.log("Options:", currentBumpOptions);
    console.log("Source image URL:", imageUrl);
  
    if (currentBumpTexture) {
      console.log("Disposing previous texture", currentBumpTexture);
      currentBumpTexture.dispose();
    }
  
    const start = performance.now();
    try {
      currentBumpTexture = await ThreeJsDoGBumpMapper.applyToMesh(plane, imageUrl, currentBumpOptions);
      const elapsed = (performance.now() - start).toFixed(1);
  
      // texture.image is the internal <canvas> or <img>
      const w = currentBumpTexture.image.width;
      const h = currentBumpTexture.image.height;
  
      console.log(`Texture size: ${w}×${h}`);
      console.log(`Bump scale: ${currentBumpOptions.bumpScale}`);
      console.log(`⏱️ Completed in ${elapsed}ms`);
      console.log("%c[BumpMap] Success ✅", "color: green;");
      
      return currentBumpTexture;
    } catch (error) {
      console.error("%c[BumpMap] Failed ❌", "color: red; font-weight:bold", error);
      throw error;
    } finally {
      console.groupEnd();
    }
}

// Apply normal map based on the bump map
async function applyNormalMap(bumpTexture) {
    console.groupCollapsed("%c[NormalMap] Applying new normal map", "color: purple; font-weight:bold");
    console.log("Options:", currentNormalOptions);
    
    if (currentNormalTexture) {
        console.log("Disposing previous normal texture", currentNormalTexture);
        currentNormalTexture.dispose();
    }
    
    const start = performance.now();
    try {
        currentNormalTexture = await ThreeJsBumpToNormalMapper.applyToMesh(
            plane, 
            bumpTexture, 
            currentNormalOptions
        );
        
        const elapsed = (performance.now() - start).toFixed(1);
        const w = currentNormalTexture.image.width;
        const h = currentNormalTexture.image.height;
        
        console.log(`Normal texture size: ${w}×${h}`);
        console.log(`Normal scale: ${currentNormalOptions.normalScale}`);
        console.log(`⏱️ Completed in ${elapsed}ms`);
        console.log("%c[NormalMap] Success ✅", "color: green;");
        
        // Ensure normalMap is active if we should be using it
        plane.material.normalMap = useNormalMap ? currentNormalTexture : null;
        plane.material.needsUpdate = true;
        
        return currentNormalTexture;
    } catch (error) {
        console.error("%c[NormalMap] Failed ❌", "color: red; font-weight:bold", error);
        throw error;
    } finally {
        console.groupEnd();
    }
}

// Combined function to apply both maps in sequence
async function applyMaps() {
    try {
        // First generate bump map
        const bumpTexture = await applyBumpMap();
        
        // Then generate normal map from bump map if enabled
        if (useNormalMap) {
            await applyNormalMap(bumpTexture);
        } else {
            // If normal map is disabled, make sure it's not applied
            if (plane.material.normalMap) {
                plane.material.normalMap = null;
                plane.material.needsUpdate = true;
            }
        }
    } catch (error) {
        console.error("Error applying maps:", error);
    }
}

// Set up the UI controls (using HTML controls)
function setupControls() {
    // Bump map controls
    const sigma1Slider = document.getElementById('sigma1');
    const sigma2Slider = document.getElementById('sigma2');
    const heightScaleSlider = document.getElementById('heightScale');
    const bumpScaleSlider = document.getElementById('bumpScale');
    const thresholdSlider = document.getElementById('threshold');
    
    // Normal map controls
    const strengthSlider = document.getElementById('strength');
    const normalScaleSlider = document.getElementById('normalScale');
    const useNormalMapCheckbox = document.getElementById('useNormalMap');
    
    // Apply changes button
    const applyButton = document.getElementById('applyChanges');
    
    // Initialize values
    if (sigma1Slider) {
        sigma1Slider.value = currentBumpOptions.sigma1;
        document.getElementById('sigma1Value').textContent = currentBumpOptions.sigma1;
    }
    
    if (sigma2Slider) {
        sigma2Slider.value = currentBumpOptions.sigma2;
        document.getElementById('sigma2Value').textContent = currentBumpOptions.sigma2;
    }
    
    if (heightScaleSlider) {
        heightScaleSlider.value = currentBumpOptions.heightScale;
        document.getElementById('heightScaleValue').textContent = currentBumpOptions.heightScale;
    }
    
    if (bumpScaleSlider) {
        bumpScaleSlider.value = currentBumpOptions.bumpScale;
        document.getElementById('bumpScaleValue').textContent = currentBumpOptions.bumpScale;
    }
    
    if (thresholdSlider) {
        thresholdSlider.value = currentBumpOptions.threshold;
        document.getElementById('thresholdValue').textContent = currentBumpOptions.threshold;
    }
    
    if (strengthSlider) {
        strengthSlider.value = currentNormalOptions.strength;
        document.getElementById('strengthValue').textContent = currentNormalOptions.strength;
    }
    
    if (normalScaleSlider) {
        normalScaleSlider.value = currentNormalOptions.normalScale;
        document.getElementById('normalScaleValue').textContent = currentNormalOptions.normalScale;
    }
    
    if (useNormalMapCheckbox) {
        useNormalMapCheckbox.checked = useNormalMap;
    }
    
    // Update value displays when sliders change
    if (sigma1Slider) {
        sigma1Slider.addEventListener('input', () => {
            document.getElementById('sigma1Value').textContent = sigma1Slider.value;
            currentBumpOptions.sigma1 = parseFloat(sigma1Slider.value);
        });
    }
    
    if (sigma2Slider) {
        sigma2Slider.addEventListener('input', () => {
            document.getElementById('sigma2Value').textContent = sigma2Slider.value;
            currentBumpOptions.sigma2 = parseFloat(sigma2Slider.value);
        });
    }
    
    if (heightScaleSlider) {
        heightScaleSlider.addEventListener('input', () => {
            document.getElementById('heightScaleValue').textContent = heightScaleSlider.value;
            currentBumpOptions.heightScale = parseFloat(heightScaleSlider.value);
        });
    }
    
    if (bumpScaleSlider) {
        bumpScaleSlider.addEventListener('input', () => {
            document.getElementById('bumpScaleValue').textContent = bumpScaleSlider.value;
            currentBumpOptions.bumpScale = parseFloat(bumpScaleSlider.value);
        });
    }
    
    if (thresholdSlider) {
        thresholdSlider.addEventListener('input', () => {
            document.getElementById('thresholdValue').textContent = thresholdSlider.value;
            currentBumpOptions.threshold = parseFloat(thresholdSlider.value);
        });
    }
    
    // Normal map control events
    if (strengthSlider) {
        strengthSlider.addEventListener('input', () => {
            document.getElementById('strengthValue').textContent = strengthSlider.value;
            currentNormalOptions.strength = parseFloat(strengthSlider.value);
        });
    }
    
    if (normalScaleSlider) {
        normalScaleSlider.addEventListener('input', () => {
            document.getElementById('normalScaleValue').textContent = normalScaleSlider.value;
            currentNormalOptions.normalScale = parseFloat(normalScaleSlider.value);
            
            // Immediately update the normal scale if we have a normal map
            if (plane.material.normalMap) {
                plane.material.normalScale.set(
                    currentNormalOptions.normalScale,
                    currentNormalOptions.normalScale
                );
                plane.material.needsUpdate = true;
            }
        });
    }
    
    if (useNormalMapCheckbox) {
        useNormalMapCheckbox.addEventListener('change', () => {
            useNormalMap = useNormalMapCheckbox.checked;
            
            // Toggle normal map visibility immediately
            if (plane.material) {
                plane.material.normalMap = useNormalMap ? currentNormalTexture : null;
                plane.material.needsUpdate = true;
            }
        });
    }
    
    // Apply changes button
    if (applyButton) {
        applyButton.addEventListener('click', () => {
            applyMaps();
        });
    } else {
        console.warn("Apply button not found in the DOM");
    }

    // Add event listener for file input
    const fileInput = document.getElementById('imageFile');
    if (fileInput) {
        fileInput.addEventListener('change', handleFileSelect);
    } else {
        console.warn("File input not found in the DOM");
    }
    
}

// Handle window resize
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Make sure to clean up object URLs when the application is closed/refreshed
window.addEventListener('beforeunload', () => {
    if (typeof imageUrl === 'string' && imageUrl.startsWith('blob:')) {
        URL.revokeObjectURL(imageUrl);
    }
});

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    
    // Update controls
    controls.update();
    
    // Optional: Add some gentle motion to showcase the bump map
    plane.rotation.y = Math.sin(Date.now() * 0.0005) * 0.2;
    
    // Render the scene
    renderer.render(scene, camera);
}

// Initialize the application
init();