// Local default canvas artwork generator to ensure CORS-free offline rendering on local file:// opens
function generateDefaultArtwork() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    
    // Gradient Background
    const gradient = ctx.createLinearGradient(0, 0, 512, 512);
    gradient.addColorStop(0, '#1e293b');
    gradient.addColorStop(0.5, '#0f172a');
    gradient.addColorStop(1, '#020617');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 512, 512);
    
    // Abstract geometric elements
    ctx.fillStyle = 'rgba(212, 175, 55, 0.25)'; // Gold Circle
    ctx.beginPath();
    ctx.arc(256, 256, 140, 0, Math.PI * 2);
    ctx.fill();
    
    // Inner outline
    ctx.strokeStyle = '#D4AF37';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(256, 256, 110, 0, Math.PI * 2);
    ctx.stroke();

    // Secondary shapes
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.beginPath();
    ctx.moveTo(120, 256);
    ctx.lineTo(256, 120);
    ctx.lineTo(392, 256);
    ctx.lineTo(256, 392);
    ctx.closePath();
    ctx.fill();
    
    // Elegant line overlays
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 256);
    ctx.lineTo(512, 256);
    ctx.moveTo(256, 0);
    ctx.lineTo(256, 512);
    ctx.stroke();
    
    // Text signature
    ctx.fillStyle = '#9ca3af';
    ctx.font = 'bold 12px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('GALLERY ABSTRACT I', 256, 260);
    
    const texture = new THREE.CanvasTexture(canvas);
    return texture;
}


// Application State
const state = {
    artType: 'frame', // 'canvas' | 'frame' | 'metal' | 'poster'
    width: 0.8,       // in meters
    height: 1.0,      // in meters
    aspectRatioLocked: true,
    imageAspectRatio: 0.8, // width / height
    
    // Canvas options
    canvasDepth: 0.038, // 1.5 inches
    canvasWrapType: 'wrap', // 'wrap' | 'black' | 'white'
    
    // Frame options
    frameColor: 'black', // 'black' | 'oak' | 'gold' | 'white'
    frameWidth: 0.04,   // 4cm
    matBoardWidth: 0.05, // 5cm
    
    // Custom wall color
    wallColor: '#e2e8f0', // default light slate grey
    
    // Lights and view
    lightPreset: 'spotlight', // 'spotlight' | 'cozy' | 'daylight'
    cameraPreset: 'front', // 'front' | 'left' | 'right' | 'above' | 'orbit'
    
    // AR Mode State
    arMode: false,
    arScale: 1.0,
    arPosition: new THREE.Vector3(0, 0, 0.02), // offset from physical target
    arRotation: 0, // y rotation
    
    // Current texture
    texture: null,
    imageUrl: null
};

// Default high-quality preset images (Unsplash abstracts/landscapes)
const presetImages = [
    'https://images.unsplash.com/photo-1541701494587-cb58502866ab?q=80&w=1200&auto=format&fit=crop', // Abstract Blue
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=1200&auto=format&fit=crop', // Beach Sunset
    'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?q=80&w=1200&auto=format&fit=crop', // Gold Foliage
    'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1200&auto=format&fit=crop'  // Pastel Fluid Art
];

// Materials Cache & Helpers
const textureLoader = new THREE.TextureLoader();
let renderer, scene, camera, controls;
let wallMesh, wallArtGroup, shadowPlane;
let spotLight, ambientLight, fillLight;

// Device Orientation variables for AR perspective illusion
let initialOrientation = { beta: null, gamma: null, alpha: null };
let smoothedOrientation = { beta: 0, gamma: 0 };
let hasOrientationData = false;

function handleOrientation(event) {
    if (event.beta === null || event.gamma === null) return;
    
    // Capture the first stable reading as the reference anchor
    if (initialOrientation.beta === null) {
        initialOrientation.beta = event.beta;
        initialOrientation.gamma = event.gamma;
        initialOrientation.alpha = event.alpha;
        hasOrientationData = true;
    }
    
    // Update raw current values
    if (hasOrientationData) {
        currentOrientation.beta = event.beta;
        currentOrientation.gamma = event.gamma;
        currentOrientation.alpha = event.alpha;
    }
}
let currentOrientation = { beta: 0, gamma: 0, alpha: 0 };

// Smooth camera target values for animations
const cameraTarget = {
    position: new THREE.Vector3(0, 0, 2.2),
    lookAt: new THREE.Vector3(0, 0, 0),
    fov: 45
};

// Initial setup
window.addEventListener('DOMContentLoaded', () => {
    initThree();
    initUI();
    // Initialize with local fallback art immediately to support offline / file:// CORS security profiles
    state.texture = generateDefaultArtwork();
    rebuildWallArt();
    
    // Attempt to load external Unsplash preset in the background
    loadPresetImage(presetImages[0]);
    animate();
});

// Initialize ThreeJS
function initThree() {
    const container = document.getElementById('canvas-container');
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Renderer - physically based, high quality
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.4;  // Brighter overall scene
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    // Scene
    scene = new THREE.Scene();

    // Subtle environment gradient (acts as soft environment light source)
    const envCanvas = document.createElement('canvas');
    envCanvas.width = 2; envCanvas.height = 512;
    const ectx = envCanvas.getContext('2d');
    const grad = ectx.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0,    '#c8d8f0'); // Cool sky blue at top
    grad.addColorStop(0.5,  '#e8e0d8'); // Neutral warm mid
    grad.addColorStop(1,    '#b0a898'); // Warm grey floor
    ectx.fillStyle = grad;
    ectx.fillRect(0, 0, 2, 512);
    const envTex = new THREE.CanvasTexture(envCanvas);
    envTex.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = envTex;  // Used for PBR reflections

    // Camera
    camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 10);
    camera.position.copy(cameraTarget.position);

    // Orbit Controls
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 + 0.1;
    controls.minDistance = 0.5;
    controls.maxDistance = 5.0;
    controls.target.copy(cameraTarget.lookAt);

    // Add Wall
    createWall();

    // Add Lights
    setupLighting();

    // Add Wall Art group
    wallArtGroup = new THREE.Group();
    scene.add(wallArtGroup);

    // Window Resize
    window.addEventListener('resize', onWindowResize);
}

// Create Virtual Wall
function createWall() {
    // Large Wall
    const wallGeo = new THREE.PlaneGeometry(10, 8);
    const wallMat = new THREE.MeshStandardMaterial({
        color: state.wallColor,
        roughness: 0.92,
        metalness: 0.0,
        envMapIntensity: 0.2
    });

    // Create custom plaster bump texture dynamically using a small canvas
    const plasterCanvas = document.createElement('canvas');
    plasterCanvas.width = 256;
    plasterCanvas.height = 256;
    const ctx = plasterCanvas.getContext('2d');
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 8000; i++) {
        const x = Math.random() * 256;
        const y = Math.random() * 256;
        const r = Math.random() * 2.5;
        const color = Math.floor(128 + (Math.random() - 0.5) * 28);
        ctx.fillStyle = `rgb(${color},${color},${color})`;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
    }
    const bumpTex = new THREE.CanvasTexture(plasterCanvas);
    bumpTex.wrapS = THREE.RepeatWrapping;
    bumpTex.wrapT = THREE.RepeatWrapping;
    bumpTex.repeat.set(12, 10);
    wallMat.bumpMap = bumpTex;
    wallMat.bumpScale = 0.006;

    wallMesh = new THREE.Mesh(wallGeo, wallMat);
    wallMesh.receiveShadow = true;
    wallMesh.position.z = 0;
    scene.add(wallMesh);

    // Floor shadow helper
    const shadowGeo = new THREE.PlaneGeometry(10, 10);
    const shadowMat = new THREE.ShadowMaterial({ opacity: 0.35 });
    shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = -4;
    shadowPlane.receiveShadow = true;
    scene.add(shadowPlane);
}

// Lighting presets config
function setupLighting() {
    // Ambient fill — soft overall light from environment
    ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    // Primary Gallery Spotlight — casts premium soft shadow downward over artwork
    spotLight = new THREE.SpotLight(0xffffff, 6.0);
    spotLight.position.set(0.3, 2.2, 1.5);
    spotLight.target.position.set(0, 0, 0);
    spotLight.angle = Math.PI / 5.5;
    spotLight.penumbra = 0.85;  // Very soft shadow edge
    spotLight.decay = 1.5;
    spotLight.castShadow = true;
    spotLight.shadow.mapSize.width  = 4096;  // Hi-res shadow map
    spotLight.shadow.mapSize.height = 4096;
    spotLight.shadow.camera.near   = 0.3;
    spotLight.shadow.camera.far    = 5;
    spotLight.shadow.bias          = -0.0003;
    spotLight.shadow.radius        = 6;  // PCF blur radius
    scene.add(spotLight);
    scene.add(spotLight.target);

    // Soft fill light from the left — removes harsh shadows
    fillLight = new THREE.DirectionalLight(0xfff0e8, 1.0);
    fillLight.position.set(-2.5, 1.0, 2.5);
    fillLight.castShadow = false;
    scene.add(fillLight);

    // Rim back-light from the right for 3D depth
    const rimLight = new THREE.DirectionalLight(0xe8f0ff, 0.4);
    rimLight.position.set(2.5, -0.5, -1);
    scene.add(rimLight);

    applyLightPreset();
}

function applyLightPreset() {
    if (state.lightPreset === 'spotlight') {
        spotLight.intensity = 5.0;
        ambientLight.color.setHex(0xffffff);
        ambientLight.intensity = 0.3;
        fillLight.intensity = 0.6;
        spotLight.color.setHex(0xffffff);
    } else if (state.lightPreset === 'cozy') {
        spotLight.intensity = 3.5;
        ambientLight.color.setHex(0xffd1a4); // warm golden light
        ambientLight.intensity = 0.5;
        fillLight.intensity = 0.4;
        spotLight.color.setHex(0xffe0bd);
    } else if (state.lightPreset === 'daylight') {
        spotLight.intensity = 1.0;
        ambientLight.color.setHex(0xe0f2fe); // cool daylight
        ambientLight.intensity = 0.9;
        fillLight.intensity = 1.2;
        spotLight.color.setHex(0xffffff);
    }
}

// Build Wall Art based on user parameters
function rebuildWallArt() {
    // Clear existing meshes
    while (wallArtGroup.children.length > 0) {
        const obj = wallArtGroup.children[0];
        wallArtGroup.remove(obj);
    }

    if (!state.texture) return;

    // Reset rotation / scale for AR placement if needed
    if (!state.arMode) {
        wallArtGroup.position.set(0, 0, 0);
        wallArtGroup.rotation.set(0, 0, 0);
        wallArtGroup.scale.set(1, 1, 1);
    } else {
        wallArtGroup.position.copy(state.arPosition);
        wallArtGroup.rotation.y = state.arRotation;
        wallArtGroup.scale.setScalar(state.arScale);
    }

    // Dispatch build depending on type
    switch (state.artType) {
        case 'canvas':
            buildCanvas();
            break;
        case 'frame':
            buildFramedPrint();
            break;
        case 'metal':
            buildMetalPrint();
            break;
        case 'poster':
            buildPoster();
            break;
        case 'shadowbox':
            buildShadowBox();
            break;
        case 'tapestry':
            buildTapestry();
            break;
        case 'neon':
            buildNeonFrame();
            break;
        case 'triptych':
            buildTriptych();
            break;
    }
}

// 1. Gallery Canvas Geometry & Texturing
function buildCanvas() {
    const w = state.width;
    const h = state.height;
    const d = state.canvasDepth;

    const geo = new THREE.BoxGeometry(w, h, d);

    // Custom wrapped canvas materials
    // Sides will be slightly darkened wrapped image or solid colors
    const sideMat = new THREE.MeshStandardMaterial({
        map: state.texture,
        roughness: 0.9,
        metalness: 0.1,
        color: state.canvasWrapType === 'wrap' ? 0x888888 : (state.canvasWrapType === 'white' ? 0xffffff : 0x111111)
    });
    
    const frontMat = new THREE.MeshStandardMaterial({
        map: state.texture,
        roughness: 0.75,
        metalness: 0.05
    });

    const materials = [
        sideMat, // right
        sideMat, // left
        sideMat, // top
        sideMat, // bottom
        frontMat, // front
        sideMat  // back
    ];

    const mesh = new THREE.Mesh(geo, materials);
    mesh.position.z = d / 2; // sit canvas flush to wall
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    wallArtGroup.add(mesh);
}

// 2. Premium Framed Print (Frame, Passe-partout/Mat Board, Glass, Image)
function buildFramedPrint() {
    const w = state.width;
    const h = state.height;
    const fWidth = state.frameWidth;
    const fDepth = 0.035; // 3.5cm depth
    const mWidth = state.matBoardWidth;
    
    // Frame Material Colors
    let frameColorHex;
    let roughness = 0.5;
    let metalness = 0.1;

    switch (state.frameColor) {
        case 'black':
            frameColorHex = 0x1a1a1a;
            roughness = 0.8;
            break;
        case 'oak':
            frameColorHex = 0xbd9f77; // Wood brown
            roughness = 0.9;
            break;
        case 'gold':
            frameColorHex = 0xd4af37; // Rich brass gold
            roughness = 0.2;
            metalness = 0.95;
            break;
        case 'white':
            frameColorHex = 0xf8fafc;
            roughness = 0.75;
            break;
    }

    const frameMat = new THREE.MeshStandardMaterial({
        color: frameColorHex,
        roughness: roughness,
        metalness: metalness
    });

    // Create 4 sides of the Frame border
    // Left & Right
    const sideGeo = new THREE.BoxGeometry(fWidth, h + fWidth * 2, fDepth);
    const frameLeft = new THREE.Mesh(sideGeo, frameMat);
    frameLeft.position.set(-w/2 - fWidth/2, 0, fDepth/2);
    frameLeft.castShadow = true;
    wallArtGroup.add(frameLeft);

    const frameRight = frameLeft.clone();
    frameRight.position.x = w/2 + fWidth/2;
    wallArtGroup.add(frameRight);

    // Top & Bottom
    const topGeo = new THREE.BoxGeometry(w, fWidth, fDepth);
    const frameTop = new THREE.Mesh(topGeo, frameMat);
    frameTop.position.set(0, h/2 + fWidth/2, fDepth/2);
    frameTop.castShadow = true;
    wallArtGroup.add(frameTop);

    const frameBottom = frameTop.clone();
    frameBottom.position.y = -h/2 - fWidth/2;
    wallArtGroup.add(frameBottom);

    // Mat Board (Passe-partout)
    const matGeo = new THREE.PlaneGeometry(w, h);
    const matMat = new THREE.MeshStandardMaterial({
        color: 0xfbfbf9, // Soft off-white
        roughness: 0.9,
        metalness: 0.0
    });
    const matMesh = new THREE.Mesh(matGeo, matMat);
    matMesh.position.z = 0.005; // Offset slightly from background board
    matMesh.receiveShadow = true;
    wallArtGroup.add(matMesh);

    // The Artwork plane
    const artworkW = w - mWidth * 2;
    const artworkH = h - mWidth * 2;
    
    // Ensure positive dimensions
    if (artworkW > 0.05 && artworkH > 0.05) {
        const artGeo = new THREE.PlaneGeometry(artworkW, artworkH);
        const artMat = new THREE.MeshStandardMaterial({
            map: state.texture,
            roughness: 0.6,
            metalness: 0.05
        });
        const artMesh = new THREE.Mesh(artGeo, artMat);
        artMesh.position.z = 0.007; // sit on top of mat board
        wallArtGroup.add(artMesh);
    }

    // Premium Glass Overlay Reflection
    const glassGeo = new THREE.PlaneGeometry(w, h);
    const glassMat = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.12,
        roughness: 0.05,
        metalness: 0.1,
        transmission: 0.9,
        ior: 1.5,
        clearcoat: 1.0,
        clearcoatRoughness: 0.05
    });
    const glassMesh = new THREE.Mesh(glassGeo, glassMat);
    glassMesh.position.z = 0.012; // In front of artwork
    wallArtGroup.add(glassMesh);

    // Backing Board for casting shadows correctly
    const backGeo = new THREE.BoxGeometry(w, h, 0.005);
    const backMat = new THREE.MeshBasicMaterial({ color: 0x222222 });
    const backingMesh = new THREE.Mesh(backGeo, backMat);
    backingMesh.position.z = 0.0025;
    backingMesh.castShadow = true;
    wallArtGroup.add(backingMesh);
}

// 3. Offset Metal Print
function buildMetalPrint() {
    const w = state.width;
    const h = state.height;
    const d = 0.003; // Ultra thin sheet

    // High reflective gloss metal panel
    const geo = new THREE.BoxGeometry(w, h, d);
    const mat = new THREE.MeshStandardMaterial({
        map: state.texture,
        roughness: 0.15,
        metalness: 0.7, // Glossy metallic sheen
    });
    
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.z = 0.015 + d / 2; // Offset by 1.5cm from wall
    mesh.castShadow = true;
    wallArtGroup.add(mesh);

    // Mount Block behind (which offsets it from the wall and casts a floating shadow)
    const blockGeo = new THREE.BoxGeometry(w * 0.7, h * 0.7, 0.015);
    const blockMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
    const blockMesh = new THREE.Mesh(blockGeo, blockMat);
    blockMesh.position.z = 0.0075;
    blockMesh.castShadow = true;
    wallArtGroup.add(blockMesh);
}

// 4. Poster with Paper Curl effect
function buildPoster() {
    const w = state.width;
    const h = state.height;
    
    // Create a mesh with vertex subdivisions to model the wave/paper curl
    const segments = 12;
    const geo = new THREE.PlaneGeometry(w, h, segments, segments);
    
    // Displace vertices to create a subtle paper wave/curl
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        
        // Displace the corners forward to look like slight curling away from wall
        // curl max depth 8mm at the corners
        const cornerFactorX = Math.pow(Math.abs(x) / (w / 2), 2);
        const cornerFactorY = Math.pow(Math.abs(y) / (h / 2), 2);
        const zDisplacement = 0.006 * cornerFactorX * cornerFactorY;
        
        // Add a gentle ripple across the paper
        const ripple = Math.sin(x * 12) * Math.cos(y * 8) * 0.001;
        
        pos.setZ(i, zDisplacement + ripple + 0.001); // sit 1mm off wall
    }
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
        map: state.texture,
        roughness: 0.85,
        metalness: 0.0,
        side: THREE.DoubleSide
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    wallArtGroup.add(mesh);
}

// 5. Shadow Box — deep float with visible gap shadow
function buildShadowBox() {
    const w = state.width;
    const h = state.height;
    const boxDepth = 0.055; // 5.5cm deep shadow box
    const innerGap = 0.012; // 1.2cm inner gap before image

    // Outer box frame (dark matte sides)
    const outerMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9, metalness: 0.05 });

    // Left and right sides
    const sideGeoLR = new THREE.BoxGeometry(boxDepth, h, boxDepth);
    [-w/2 - boxDepth/2, w/2 + boxDepth/2].forEach(x => {
        const side = new THREE.Mesh(sideGeoLR, outerMat);
        side.position.set(x, 0, boxDepth / 2);
        side.castShadow = true;
        wallArtGroup.add(side);
    });

    // Top and bottom sides
    const sideGeoTB = new THREE.BoxGeometry(w + boxDepth * 2, boxDepth, boxDepth);
    [h/2 + boxDepth/2, -h/2 - boxDepth/2].forEach(y => {
        const side = new THREE.Mesh(sideGeoTB, outerMat);
        side.position.set(0, y, boxDepth / 2);
        side.castShadow = true;
        wallArtGroup.add(side);
    });

    // Artwork printed on a slightly recessed inner plane
    const artGeo = new THREE.PlaneGeometry(w, h);
    const artMat = new THREE.MeshStandardMaterial({
        map: state.texture,
        roughness: 0.75,
        metalness: 0.0
    });
    const artMesh = new THREE.Mesh(artGeo, artMat);
    artMesh.position.z = innerGap; // recessed inside the box
    artMesh.castShadow = false;
    artMesh.receiveShadow = true;
    wallArtGroup.add(artMesh);

    // Front opening invisible (open face of box) - just the gap is visible
    // Backing shadow board at the rear
    const backGeo = new THREE.BoxGeometry(w + boxDepth * 2, h + boxDepth * 2, 0.005);
    const backMat = new THREE.MeshBasicMaterial({ color: 0x0a0a0a });
    const backMesh = new THREE.Mesh(backGeo, backMat);
    backMesh.position.z = 0.001;
    backMesh.castShadow = true;
    wallArtGroup.add(backMesh);
}

// 6. Tapestry — fabric hang with linen texture
function buildTapestry() {
    const w = state.width;
    const h = state.height;

    // Create fabric weave texture with canvas
    const weaveCanvas = document.createElement('canvas');
    weaveCanvas.width = 64;
    weaveCanvas.height = 64;
    const wctx = weaveCanvas.getContext('2d');
    for (let y = 0; y < 64; y++) {
        for (let x = 0; x < 64; x++) {
            const v = ((x + y) % 2 === 0) ? 200 : 180;
            wctx.fillStyle = `rgb(${v},${v-10},${v-20})`;
            wctx.fillRect(x, y, 1, 1);
        }
    }
    const weaveTex = new THREE.CanvasTexture(weaveCanvas);
    weaveTex.wrapS = weaveTex.wrapT = THREE.RepeatWrapping;
    weaveTex.repeat.set(w * 40, h * 40);

    // Image layer
    const artGeo = new THREE.PlaneGeometry(w, h, 12, 12);
    // Add subtle fabric drape by displacing vertices
    const pos = artGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        // Gentle drape: center hangs slightly forward, bottom dips back
        const drape = 0.012 * Math.cos(Math.PI * (y / (h / 2)) * 0.5);
        const ripple = Math.sin(x * 8) * 0.003;
        pos.setZ(i, drape + ripple + 0.003);
    }
    artGeo.computeVertexNormals();

    const artMat = new THREE.MeshStandardMaterial({
        map: state.texture,
        roughness: 0.9,
        metalness: 0.0,
        bumpMap: weaveTex,
        bumpScale: 0.004
    });
    const artMesh = new THREE.Mesh(artGeo, artMat);
    artMesh.castShadow = true;
    wallArtGroup.add(artMesh);

    // Hanging rod at top
    const rodGeo = new THREE.CylinderGeometry(0.008, 0.008, w + 0.08, 12);
    const rodMat = new THREE.MeshStandardMaterial({ color: 0x5c3d1e, roughness: 0.6, metalness: 0.1 });
    const rod = new THREE.Mesh(rodGeo, rodMat);
    rod.rotation.z = Math.PI / 2;
    rod.position.set(0, h / 2 + 0.012, 0.016);
    rod.castShadow = true;
    wallArtGroup.add(rod);

    // Hanging cords left + right
    [-(w / 2 + 0.02), w / 2 + 0.02].forEach(x => {
        const cordGeo = new THREE.CylinderGeometry(0.003, 0.003, 0.1, 6);
        const cord = new THREE.Mesh(cordGeo, rodMat);
        cord.position.set(x, h / 2 + 0.065, 0.016);
        wallArtGroup.add(cord);
    });
}

// 7. Neon Frame — glowing emissive LED border
function buildNeonFrame() {
    const w = state.width;
    const h = state.height;
    const tubeR = 0.008; // tube radius

    // Neon glow material — bright emissive
    const neonMat = new THREE.MeshStandardMaterial({
        color: 0x00f0ff,
        emissive: 0x00f0ff,
        emissiveIntensity: 3.0,
        roughness: 0.3,
        metalness: 0.1
    });

    // Top and bottom tubes
    const hTubeGeo = new THREE.CylinderGeometry(tubeR, tubeR, w + tubeR * 2, 12);
    [h/2, -h/2].forEach(y => {
        const tube = new THREE.Mesh(hTubeGeo, neonMat);
        tube.rotation.z = Math.PI / 2;
        tube.position.set(0, y, 0.025);
        wallArtGroup.add(tube);
    });

    // Left and right tubes
    const vTubeGeo = new THREE.CylinderGeometry(tubeR, tubeR, h, 12);
    [-w/2, w/2].forEach(x => {
        const tube = new THREE.Mesh(vTubeGeo, neonMat);
        tube.position.set(x, 0, 0.025);
        wallArtGroup.add(tube);
    });

    // Dark backing board
    const backGeo = new THREE.PlaneGeometry(w + 0.06, h + 0.06);
    const backMat = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 1.0 });
    const back = new THREE.Mesh(backGeo, backMat);
    back.position.z = 0.002;
    back.castShadow = true;
    wallArtGroup.add(back);

    // Artwork plane behind glass
    const artGeo = new THREE.PlaneGeometry(w - 0.02, h - 0.02);
    const artMat = new THREE.MeshStandardMaterial({
        map: state.texture,
        roughness: 0.5,
        metalness: 0.0
    });
    const artMesh = new THREE.Mesh(artGeo, artMat);
    artMesh.position.z = 0.015;
    wallArtGroup.add(artMesh);

    // Subtle glow halo as a slightly enlarged emissive plane behind the border
    const haloGeo = new THREE.PlaneGeometry(w + 0.1, h + 0.1);
    const haloMat = new THREE.MeshBasicMaterial({
        color: 0x00f0ff,
        transparent: true,
        opacity: 0.06
    });
    const halo = new THREE.Mesh(haloGeo, haloMat);
    halo.position.z = 0.001;
    wallArtGroup.add(halo);
}

// 8. Triptych — 3-panel split display
function buildTriptych() {
    const totalW = state.width;
    const h = state.height;
    const gap = 0.025; // 2.5cm gap between panels
    const panels = 3;
    const panelW = (totalW - gap * (panels - 1)) / panels;
    const frameW = 0.018;
    const frameD = 0.032;

    const frameMat = new THREE.MeshStandardMaterial({
        color: 0x1a1a1a,
        roughness: 0.8,
        metalness: 0.1
    });

    for (let i = 0; i < panels; i++) {
        const xOffset = (i - 1) * (panelW + gap); // -1, 0, +1 centered

        // Texture UV offset to show a different third of the image per panel
        const artGeo = new THREE.PlaneGeometry(panelW, h);
        // Shift UV coordinates per panel slice
        const uvAttr = artGeo.attributes.uv;
        for (let j = 0; j < uvAttr.count; j++) {
            const u = uvAttr.getX(j);
            // Map from [0,1] to [i/3, (i+1)/3]
            uvAttr.setX(j, (i + u) / panels);
        }
        uvAttr.needsUpdate = true;

        const artMat = new THREE.MeshStandardMaterial({
            map: state.texture,
            roughness: 0.65,
            metalness: 0.0
        });
        const artMesh = new THREE.Mesh(artGeo, artMat);
        artMesh.position.set(xOffset, 0, 0.012);
        artMesh.castShadow = true;
        wallArtGroup.add(artMesh);

        // Thin frame border for each panel
        const fSideGeo = new THREE.BoxGeometry(frameW, h + frameW * 2, frameD);
        [-panelW/2 - frameW/2, panelW/2 + frameW/2].forEach(fx => {
            const fSide = new THREE.Mesh(fSideGeo, frameMat);
            fSide.position.set(xOffset + fx, 0, frameD / 2);
            fSide.castShadow = true;
            wallArtGroup.add(fSide);
        });
        const fTopGeo = new THREE.BoxGeometry(panelW, frameW, frameD);
        [h/2 + frameW/2, -h/2 - frameW/2].forEach(fy => {
            const fTop = new THREE.Mesh(fTopGeo, frameMat);
            fTop.position.set(xOffset, fy, frameD / 2);
            fTop.castShadow = true;
            wallArtGroup.add(fTop);
        });
    }
}

// Load Image presets or uploaded files
function loadPresetImage(url) {
    state.imageUrl = url;
    document.getElementById('upload-status').style.display = 'block';
    
    textureLoader.load(
        url,
        (loadedTexture) => {
            document.getElementById('upload-status').style.display = 'none';
            state.texture = loadedTexture;
            
            // Calculate aspect ratio
            const img = loadedTexture.image;
            state.imageAspectRatio = img.width / img.height;
            
            if (state.aspectRatioLocked) {
                matchArtworkToImageAspect();
            } else {
                rebuildWallArt();
            }
            showToast('Artwork loaded successfully!');
        },
        undefined,
        (err) => {
            document.getElementById('upload-status').style.display = 'none';
            showToast('Using local abstract art fallback.');
            console.warn('Unable to load remote preset image (expected under local file:// environment due to CORS).', err);
            
            // Keep using local canvas texture if it's already set
            if (!state.texture) {
                state.texture = generateDefaultArtwork();
                rebuildWallArt();
            }
        }
    );
}

function matchArtworkToImageAspect() {
    if (state.imageAspectRatio > 1) {
        // Landscape image: fix width, adjust height
        state.width = 1.0;
        state.height = Math.round((1.0 / state.imageAspectRatio) * 100) / 100;
    } else {
        // Portrait or Square: fix height, adjust width
        state.height = 1.0;
        state.width = Math.round((1.0 * state.imageAspectRatio) * 100) / 100;
    }
    
    // Update Sliders in UI
    document.getElementById('width-slider').value = state.width;
    document.getElementById('width-val').innerText = Math.round(state.width * 100) + ' cm';
    document.getElementById('height-slider').value = state.height;
    document.getElementById('height-val').innerText = Math.round(state.height * 100) + ' cm';
    
    rebuildWallArt();
}

// Window resize
function onWindowResize() {
    const container = document.getElementById('canvas-container');
    const width = container.clientWidth;
    const height = container.clientHeight;
    
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    
    // Clear mobile collapsed state when resizing to desktop sizes
    if (window.innerWidth > 992) {
        document.body.classList.remove('sidebar-collapsed');
    }
}

// Camera transition interpolation — called in render loop only when NOT in orbit mode
function updateCameraTransition() {
    // Set target coordinates based on state
    switch (state.cameraPreset) {
        case 'front':
            cameraTarget.position.set(0, 0, 2.2);
            cameraTarget.lookAt.set(0, 0, 0);
            cameraTarget.fov = 45;
            break;
        case 'left':
            cameraTarget.position.set(-1.8, 0.2, 1.6);
            cameraTarget.lookAt.set(0.3, 0, 0);
            cameraTarget.fov = 45;
            break;
        case 'right':
            cameraTarget.position.set(1.8, 0.2, 1.6);
            cameraTarget.lookAt.set(-0.3, 0, 0);
            cameraTarget.fov = 45;
            break;
        case 'above':
            cameraTarget.position.set(0, 1.8, 1.4);
            cameraTarget.lookAt.set(0, 0, 0);
            cameraTarget.fov = 52;
            break;
        default:
            return; // orbit mode — handled by controls.update()
    }

    // Lerp position smoothly
    camera.position.lerp(cameraTarget.position, 0.1);

    // Directly aim camera — NOT via OrbitControls, so there is no override fight
    camera.lookAt(cameraTarget.lookAt);

    // FOV transition
    if (Math.abs(camera.fov - cameraTarget.fov) > 0.05) {
        camera.fov = THREE.MathUtils.lerp(camera.fov, cameraTarget.fov, 0.1);
        camera.updateProjectionMatrix();
    }
}

// Main animation loop
function animate() {
    requestAnimationFrame(animate);
    
    if (!state.arMode) {
        if (state.cameraPreset === 'orbit') {
            // ONLY update OrbitControls when in orbit/free mode
            // In all preset modes, controls.update() would fight against our camera.lookAt()
            controls.update();
        } else {
            // Preset camera movement: lerp position and point at target directly
            updateCameraTransition();
        }
    } else {
        // AR mode: art tilts with gyroscope, camera is locked
        if (hasOrientationData) {
            const dBeta  = currentOrientation.beta  - initialOrientation.beta;
            const dGamma = currentOrientation.gamma - initialOrientation.gamma;
            
            smoothedOrientation.beta  = smoothedOrientation.beta  * 0.85 + dBeta  * 0.15;
            smoothedOrientation.gamma = smoothedOrientation.gamma * 0.85 + dGamma * 0.15;
            
            const clampedBeta  = Math.max(-35, Math.min(35, smoothedOrientation.beta));
            const clampedGamma = Math.max(-35, Math.min(35, smoothedOrientation.gamma));
            
            const targetX = THREE.MathUtils.degToRad(clampedBeta)  * 0.18;
            const targetY = THREE.MathUtils.degToRad(clampedGamma) * 0.18;
            
            wallArtGroup.rotation.x = THREE.MathUtils.lerp(wallArtGroup.rotation.x, targetX, 0.12);
            wallArtGroup.rotation.y = THREE.MathUtils.lerp(wallArtGroup.rotation.y, targetY, 0.12);
        }
        
        camera.position.set(0, 0, 1.8);
        camera.lookAt(0, 0, 0);
    }
    
    renderer.render(scene, camera);
}

// Toast Utility
function showToast(msg) {
    const toast = document.getElementById('toast-msg');
    toast.querySelector('.toast-text').innerText = msg;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Initialize UI Bindings
function initUI() {
    // 1. Upload logic
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('file-input');
    
    dropzone.addEventListener('click', () => fileInput.click());
    
    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
    });
    
    dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('dragover');
    });
    
    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
            handleFileUpload(e.dataTransfer.files[0]);
        }
    });
    
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFileUpload(e.target.files[0]);
        }
    });

    function handleFileUpload(file) {
        if (!file.type.startsWith('image/')) {
            showToast('Please upload an image file (JPG, PNG)');
            return;
        }
        const url = URL.createObjectURL(file);
        loadPresetImage(url);
    }

    // Preset items click
    document.querySelectorAll('.preset-item').forEach((item) => {
        item.addEventListener('click', () => {
            document.querySelectorAll('.preset-item').forEach(p => p.classList.remove('active'));
            item.classList.add('active');
            loadPresetImage(item.dataset.src);
        });
    });

    // 2. Wall Art Type Switcher
    document.querySelectorAll('.type-card').forEach((card) => {
        card.addEventListener('click', () => {
            document.querySelectorAll('.type-card').forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            state.artType = card.dataset.type;
            
            // Toggle visibility of frame vs canvas specific options
            document.getElementById('frame-customizer').style.display = state.artType === 'frame' ? 'flex' : 'none';
            document.getElementById('canvas-customizer').style.display = state.artType === 'canvas' ? 'flex' : 'none';
            
            rebuildWallArt();
        });
    });

    // 3. Wall Color Customizer
    const customWallPicker = document.getElementById('wall-color-custom');
    customWallPicker.addEventListener('input', (e) => {
        const color = e.target.value;
        state.wallColor = color;
        wallMesh.material.color.set(color);
        document.querySelectorAll('.wall-preset-btn').forEach(btn => btn.classList.remove('active'));
    });
    
    document.querySelectorAll('.wall-preset-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.wall-preset-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const color = btn.dataset.color;
            state.wallColor = color;
            wallMesh.material.color.set(color);
            customWallPicker.value = color;
        });
    });

    // 4. Width and Height sliders
    const widthSlider = document.getElementById('width-slider');
    const widthVal = document.getElementById('width-val');
    widthSlider.addEventListener('input', (e) => {
        state.width = parseFloat(e.target.value);
        widthVal.innerText = Math.round(state.width * 100) + ' cm';
        
        if (state.aspectRatioLocked) {
            state.height = Math.round((state.width / state.imageAspectRatio) * 100) / 100;
            document.getElementById('height-slider').value = state.height;
            document.getElementById('height-val').innerText = Math.round(state.height * 100) + ' cm';
        }
        rebuildWallArt();
    });

    const heightSlider = document.getElementById('height-slider');
    const heightVal = document.getElementById('height-val');
    heightSlider.addEventListener('input', (e) => {
        state.height = parseFloat(e.target.value);
        heightVal.innerText = Math.round(state.height * 100) + ' cm';
        
        if (state.aspectRatioLocked) {
            state.width = Math.round((state.height * state.imageAspectRatio) * 100) / 100;
            document.getElementById('width-slider').value = state.width;
            document.getElementById('width-val').innerText = Math.round(state.width * 100) + ' cm';
        }
        rebuildWallArt();
    });

    // Lock Aspect Ratio Switcher
    const aspectBtn = document.getElementById('aspect-lock-btn');
    aspectBtn.addEventListener('click', () => {
        state.aspectRatioLocked = !state.aspectRatioLocked;
        if (state.aspectRatioLocked) {
            aspectBtn.classList.add('active');
            aspectBtn.innerText = 'Lock Aspect Ratio: ON';
            matchArtworkToImageAspect();
        } else {
            aspectBtn.classList.remove('active');
            aspectBtn.innerText = 'Lock Aspect Ratio: OFF';
        }
    });

    // 5. Frame Color dots
    document.querySelectorAll('.frame-color-dot').forEach((dot) => {
        dot.addEventListener('click', () => {
            document.querySelectorAll('.frame-color-dot').forEach(d => d.classList.remove('active'));
            dot.classList.add('active');
            state.frameColor = dot.dataset.color;
            rebuildWallArt();
        });
    });

    // Frame & Mat Board dimensions
    const frameWidthSlider = document.getElementById('frame-width-slider');
    frameWidthSlider.addEventListener('input', (e) => {
        state.frameWidth = parseFloat(e.target.value);
        document.getElementById('frame-width-val').innerText = Math.round(state.frameWidth * 100) + ' cm';
        rebuildWallArt();
    });

    const matWidthSlider = document.getElementById('mat-width-slider');
    matWidthSlider.addEventListener('input', (e) => {
        state.matBoardWidth = parseFloat(e.target.value);
        document.getElementById('mat-width-val').innerText = Math.round(state.matBoardWidth * 100) + ' cm';
        rebuildWallArt();
    });

    // Canvas depth selection
    const canvasDepthSlider = document.getElementById('canvas-depth-slider');
    canvasDepthSlider.addEventListener('input', (e) => {
        state.canvasDepth = parseFloat(e.target.value);
        document.getElementById('canvas-depth-val').innerText = (state.canvasDepth * 100).toFixed(1) + ' cm';
        rebuildWallArt();
    });

    // Canvas wrap segmented control
    document.querySelectorAll('#canvas-wrap-control .segment-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#canvas-wrap-control .segment-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.canvasWrapType = btn.dataset.wrap;
            rebuildWallArt();
        });
    });

    // 6. Camera View HUD Controls
    document.querySelectorAll('.view-angle-btn').forEach(function(hudBtn) {
        hudBtn.addEventListener('click', function() {
            if (state.arMode) return;
            document.querySelectorAll('.view-angle-btn').forEach(function(b) { b.classList.remove('active'); });
            hudBtn.classList.add('active');
            state.cameraPreset = hudBtn.dataset.angle;
            if (state.cameraPreset === 'orbit') {
                controls.enabled = true;
                controls.target.set(0, 0, 0);
                controls.update();
            } else {
                controls.enabled = false;
                var presets = {
                    'front': { pos: new THREE.Vector3(0,    0,    2.2), look: new THREE.Vector3(0,    0, 0) },
                    'left':  { pos: new THREE.Vector3(-1.8, 0.2,  1.6), look: new THREE.Vector3(0.3,  0, 0) },
                    'right': { pos: new THREE.Vector3(1.8,  0.2,  1.6), look: new THREE.Vector3(-0.3, 0, 0) },
                    'above': { pos: new THREE.Vector3(0,    1.8,  1.4), look: new THREE.Vector3(0,    0, 0) }
                };
                var tgt = presets[state.cameraPreset];
                if (tgt) {
                    camera.position.lerp(tgt.pos, 0.5);
                    camera.lookAt(tgt.look);
                    cameraTarget.position.copy(tgt.pos);
                    cameraTarget.lookAt.copy(tgt.look);
                }
            }
        });
    });

    // Lighting HUD switcher
    document.querySelectorAll('.light-preset-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.light-preset-btn').forEach(function(b) { b.classList.remove('active'); });
            btn.classList.add('active');
            state.lightPreset = btn.dataset.light;
            applyLightPreset();
        });
    });


    // 7. AR Camera Overlay Mode Activation
    const arBtn = document.getElementById('ar-toggle-btn');
    const exitArBtn = document.getElementById('ar-exit-btn');
    const video = document.getElementById('camera-video');
    const touchListener = document.getElementById('touch-listener');
    const arInstructions = document.getElementById('ar-overlay-instructions');
    
    let cameraStream = null;

    arBtn.addEventListener('click', () => {
        activateAR();
    });

    exitArBtn.addEventListener('click', () => {
        deactivateAR();
    });

    function activateAR() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            showToast("Camera access not supported on this device/browser");
            return;
        }

        // Request DeviceOrientation permission dynamically inside click handler for iOS Safari
        if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
            DeviceOrientationEvent.requestPermission()
                .then(permissionState => {
                    if (permissionState === 'granted') {
                        window.addEventListener('deviceorientation', handleOrientation);
                    }
                })
                .catch(err => {
                    console.warn("DeviceOrientation permission rejected/failed:", err);
                });
        } else {
            // Android or desktop browsers
            window.addEventListener('deviceorientation', handleOrientation);
        }

        document.getElementById('upload-status').style.display = 'block';

        // Prompt camera with back camera query if mobile
        navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: 'environment',
                width: { ideal: 1280 },
                height: { ideal: 720 }
            },
            audio: false
        }).then((stream) => {
            document.getElementById('upload-status').style.display = 'none';
            cameraStream = stream;
            video.srcObject = stream;
            video.play();
            video.style.display = 'block';

            // Make 3D Background transparent & hide virtual wall
            state.arMode = true;
            document.body.classList.add('ar-mode-active');
            wallMesh.visible = false;
            shadowPlane.visible = false;
            renderer.setClearColor(0x000000, 0.0);
            renderer.setClearAlpha(0.0); // Explicitly clear alpha for iOS Safari compatibility
            
            // Adjust lighting to look natural
            spotLight.intensity = 1.5;
            ambientLight.intensity = 0.8;
            fillLight.intensity = 0.8;

            // Enable touch listeners overlays
            touchListener.style.display = 'block';
            exitArBtn.style.display = 'block';
            arInstructions.style.display = 'block';
            
            // Position canvas element onto screen space for AR alignment
            state.arScale = 0.6; // Scale down slightly in AR overlay
            state.arPosition.set(0, 0, 0.1);
            state.arRotation = 0;
            
            controls.enabled = false; // Disable orbit controls in AR
            state.cameraPreset = 'front'; // Lock camera to front view looking straight ahead
            camera.position.set(0, 0, 1.8);
            controls.target.set(0, 0, 0);
            camera.lookAt(0, 0, 0);

            rebuildWallArt();
            
            // Force WebGL drawing context buffer sizes to expand to full screen immediately
            onWindowResize();
            setTimeout(onWindowResize, 100);
            setTimeout(onWindowResize, 400);

            showToast("AR Simulator active. Point camera to a wall.");
        }).catch((err) => {
            document.getElementById('upload-status').style.display = 'none';
            showToast("Camera access denied.");
            console.error("Camera error:", err);
        });
    }

    function deactivateAR() {
        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
            cameraStream = null;
        }
        video.style.display = 'none';
        video.srcObject = null;

        // Clean up DeviceOrientation tracking listeners
        window.removeEventListener('deviceorientation', handleOrientation);
        initialOrientation = { beta: null, gamma: null, alpha: null };
        hasOrientationData = false;

        state.arMode = false;
        document.body.classList.remove('ar-mode-active');
        wallMesh.visible = true;
        shadowPlane.visible = true;
        renderer.setClearColor(0x000000, 1);
        
        applyLightPreset();

        touchListener.style.display = 'none';
        exitArBtn.style.display = 'none';
        arInstructions.style.display = 'none';

        controls.enabled = true;
        state.cameraPreset = 'orbit';
        document.querySelectorAll('.view-angle-btn').forEach(b => b.classList.remove('active'));
        document.querySelector('.view-angle-btn[data-angle="orbit"]').classList.add('active');

        rebuildWallArt();
        showToast("Returned to 3D virtual studio.");
    }

    // Touch & Drag controls for positioning in AR mode
    let isDragging = false;
    let dragStartPos = { x: 0, y: 0 };
    let initialArtPos = new THREE.Vector3();
    let initialPinchDist = 0;
    let initialScale = 1.0;

    touchListener.addEventListener('mousedown', (e) => {
        if (!state.arMode) return;
        isDragging = true;
        dragStartPos = { x: e.clientX, y: e.clientY };
        initialArtPos.copy(wallArtGroup.position);
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging || !state.arMode) return;
        
        // Calculate standard mouse movement vectors in meters, proportional to viewport size at depth
        const zDepth = camera.position.z;
        const vFovRad = (camera.fov * Math.PI) / 360;
        const frustumHeight = 2 * zDepth * Math.tan(vFovRad);
        const frustumWidth = frustumHeight * camera.aspect;

        const dx = ((e.clientX - dragStartPos.x) / window.innerWidth) * frustumWidth;
        const dy = -((e.clientY - dragStartPos.y) / window.innerHeight) * frustumHeight;
        
        wallArtGroup.position.set(
            initialArtPos.x + dx,
            initialArtPos.y + dy,
            wallArtGroup.position.z
        );
        
        state.arPosition.copy(wallArtGroup.position);
    });

    window.addEventListener('mouseup', () => {
        isDragging = false;
    });

    // Touch Support for mobile dragging
    touchListener.addEventListener('touchstart', (e) => {
        if (!state.arMode) return;
        
        if (e.touches.length === 1) {
            isDragging = true;
            dragStartPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            initialArtPos.copy(wallArtGroup.position);
        } else if (e.touches.length === 2) {
            isDragging = false;
            // Pinch-to-zoom setup
            initialPinchDist = getTouchDistance(e.touches[0], e.touches[1]);
            initialScale = state.arScale;
        }
    });

    touchListener.addEventListener('touchmove', (e) => {
        if (!state.arMode) return;
        e.preventDefault();
        
        if (isDragging && e.touches.length === 1) {
            const zDepth = camera.position.z;
            const vFovRad = (camera.fov * Math.PI) / 360;
            const frustumHeight = 2 * zDepth * Math.tan(vFovRad);
            const frustumWidth = frustumHeight * camera.aspect;

            const dx = ((e.touches[0].clientX - dragStartPos.x) / window.innerWidth) * frustumWidth;
            const dy = -((e.touches[0].clientY - dragStartPos.y) / window.innerHeight) * frustumHeight;
            
            wallArtGroup.position.set(
                initialArtPos.x + dx,
                initialArtPos.y + dy,
                wallArtGroup.position.z
            );
            state.arPosition.copy(wallArtGroup.position);
        } else if (e.touches.length === 2) {
            // Pinch to scale
            const currentDist = getTouchDistance(e.touches[0], e.touches[1]);
            const factor = currentDist / initialPinchDist;
            state.arScale = Math.min(Math.max(initialScale * factor, 0.2), 3.0);
            wallArtGroup.scale.setScalar(state.arScale);
        }
    }, { passive: false });

    touchListener.addEventListener('touchend', () => {
        isDragging = false;
    });

    // Collapsible Bottom Sheet for Mobile Configurator
    const sidebarHeader = document.querySelector('.sidebar-header');
    const dragHandle = document.querySelector('.mobile-drag-handle');
    
    const toggleSidebar = (e) => {
        // Prevent toggle if clicking elements inside header like inputs
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'A' || e.target.closest('.logo-icon')) return;
        
        if (window.innerWidth <= 992) {
            document.body.classList.toggle('sidebar-collapsed');
            // Trigger three.js canvas size adjustment after CSS animation completes
            setTimeout(onWindowResize, 450);
        }
    };
    
    if (sidebarHeader) sidebarHeader.addEventListener('click', toggleSidebar);
    if (dragHandle) dragHandle.addEventListener('click', toggleSidebar);

    // Swipe gestures on header to slide drawer open/closed on mobile
    let touchStartY = 0;
    if (sidebarHeader) {
        sidebarHeader.addEventListener('touchstart', (e) => {
            touchStartY = e.touches[0].clientY;
        }, { passive: true });
        
        sidebarHeader.addEventListener('touchend', (e) => {
            const touchEndY = e.changedTouches[0].clientY;
            const diffY = touchEndY - touchStartY;
            
            if (Math.abs(diffY) > 40) { // minimum 40px swipe distance
                if (diffY > 0) {
                    // Swipe Down: Collapse
                    document.body.classList.add('sidebar-collapsed');
                } else {
                    // Swipe Up: Expand
                    document.body.classList.remove('sidebar-collapsed');
                }
                setTimeout(onWindowResize, 450);
            }
        }, { passive: true });
    }

    function getTouchDistance(t1, t2) {
        const dx = t1.clientX - t2.clientX;
        const dy = t1.clientY - t2.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }
}
