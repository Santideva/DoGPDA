import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ThreeJsDoGBumpMapper} from './js/DoGBumpMapper.js';
import './css/styles.css';

// Global variables
let scene, camera, renderer, controls;
let plane, currentTexture;
let currentOptions = {
    sigma1: 1.0,
    sigma2: 2.0,
    heightScale: 1.0,
    bumpScale: 0.1,
    threshold: 0.1
};

// Sample image URL
const imageUrl = new URL('./assets/textures/Clevelandart.jpg', import.meta.url).href;
// In a real project, you would use:
// const imageUrl = new URL('../assets/textures/your-texture.jpg', import.meta.url).href;

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
    
    // Apply initial bump map
    applyBumpMap();
    
    // Set up event listeners
    window.addEventListener('resize', onWindowResize);
    setupControls();
    
    // Start animation loop
    animate();
}

// Apply the bump map with current options
async function applyBumpMap() {
    try {
        // If we had a previous texture, dispose it properly
        if (currentTexture) {
            currentTexture.dispose();
        }
        
        // Apply new bump map
        currentTexture = await ThreeJsDoGBumpMapper.applyToMesh(plane, imageUrl, currentOptions);
        
        console.log("Bump map applied successfully");
    } catch (error) {
        console.error("Failed to apply bump map:", error);
    }
}

// Set up the UI controls (using HTML controls)
function setupControls() {
    const sigma1Slider = document.getElementById('sigma1');
    const sigma2Slider = document.getElementById('sigma2');
    const heightScaleSlider = document.getElementById('heightScale');
    const bumpScaleSlider = document.getElementById('bumpScale');
    const thresholdSlider = document.getElementById('threshold');
    const applyButton = document.getElementById('applyChanges');
    
    // Update value displays when sliders change
    sigma1Slider.addEventListener('input', () => {
        document.getElementById('sigma1Value').textContent = sigma1Slider.value;
        currentOptions.sigma1 = parseFloat(sigma1Slider.value);
    });
    
    sigma2Slider.addEventListener('input', () => {
        document.getElementById('sigma2Value').textContent = sigma2Slider.value;
        currentOptions.sigma2 = parseFloat(sigma2Slider.value);
    });
    
    heightScaleSlider.addEventListener('input', () => {
        document.getElementById('heightScaleValue').textContent = heightScaleSlider.value;
        currentOptions.heightScale = parseFloat(heightScaleSlider.value);
    });
    
    bumpScaleSlider.addEventListener('input', () => {
        document.getElementById('bumpScaleValue').textContent = bumpScaleSlider.value;
        currentOptions.bumpScale = parseFloat(bumpScaleSlider.value);
    });
    
    thresholdSlider.addEventListener('input', () => {
        document.getElementById('thresholdValue').textContent = thresholdSlider.value;
        currentOptions.threshold = parseFloat(thresholdSlider.value);
    });
    
    // Apply changes button
    applyButton.addEventListener('click', () => {
        applyBumpMap();
    });
}

// Handle window resize
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

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