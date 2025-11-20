// sfera.js - versione aggiornata
// Comporta:
// - apparizione: 1 giro lento, easing cubic-bezier(0.25,0.1,0.25,1), ritorno fluido alla rotazione originale
// - click: almeno 3 giri, easing cubic-bezier(0.5,0,0.3,1), parte sempre dalla rotazione originale
// - animazioni indipendenti, nessun drift

// --- variabili globali ---
let scene, camera, renderer, sphere;
let videoSfondo, textureSfondo;
let mouse = new THREE.Vector2();
let targetRotation = new THREE.Vector2(0, 0);
let clock = new THREE.Clock();

const APPEAR_HEIGHT = 1800;

let sphereVisible = false;
let appearProgress = 0;
let disappearProgress = 0;
let raycaster = new THREE.Raycaster();
let sphereStartY = -1;
let sphereFinalY = 0;
let sphereSize = 0.5;

// Rotazione Z originale
let originalZ = 0;

// Animator state
let appearAnimator = null;
let clickAnimator = null;

// Stato hover Three.js → cursor.js
window.isHoverSphere = false;

// --- easing cubic-bezier utility ---
// Returns an easing function f(t) that maps t:[0,1] -> [0,1] according to cubic-bezier control points
function cubicBezierEasing(x1, y1, x2, y2) {
    // Based on the implementation used in many animation libs.
    // We solve for t given x using Newton-Raphson on bezier x(t), then compute y(t).

    function A(a1, a2) { return 1.0 - 3.0 * a2 + 3.0 * a1; }
    function B(a1, a2) { return 3.0 * a2 - 6.0 * a1; }
    function C(a1)     { return 3.0 * a1; }

    function calcBezier(t, a1, a2) {
        return ((A(a1, a2) * t + B(a1, a2)) * t + C(a1)) * t;
    }
    function calcBezierDerivative(t, a1, a2) {
        return (3.0 * A(a1, a2) * t + 2.0 * B(a1, a2)) * t + C(a1);
    }

    function solveCurveX(x) {
        const EPSILON = 1e-6;
        let t = x; // initial guess
        // Newton-Raphson
        for (let i = 0; i < 8; i++) {
            let xEst = calcBezier(t, x1, x2) - x;
            if (Math.abs(xEst) < EPSILON) return t;
            let d = calcBezierDerivative(t, x1, x2);
            if (Math.abs(d) < 1e-6) break;
            t -= xEst / d;
        }
        // fallback to bisection
        let t0 = 0, t1 = 1, t2 = x;
        while (t0 < t1) {
            let xEst = calcBezier(t2, x1, x2);
            if (Math.abs(xEst - x) < EPSILON) return t2;
            if (x > xEst) t0 = t2; else t1 = t2;
            t2 = (t1 - t0) * 0.5 + t0;
        }
        return t2;
    }

    return function(t) {
        if (t <= 0) return 0;
        if (t >= 1) return 1;
        const solvedT = solveCurveX(t);
        return calcBezier(solvedT, y1, y2);
    };
}

// Easing instances
const appearEasing = cubicBezierEasing(0.25, 0.1, 0.25, 1); // molto morbido
const clickEasing  = cubicBezierEasing(0.5, 0, 0.3, 1);     // richiesto (dinamico)

// --- inizializzazione ---
function init() {
    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1, 1000
    );
    camera.position.z = 9;

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    document.getElementById('container').appendChild(renderer.domElement);

    setupVideo();
    createSphere();

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0xffffff, 0.5);
    pointLight.position.set(5, 5, 5);
    scene.add(pointLight);

    window.addEventListener('resize', onWindowResize);
    window.addEventListener('click', onClickScene);
    document.addEventListener('mousemove', onDocumentMouseMove, false);
    window.addEventListener('scroll', onScrollShowSphere);

    animate();
}

function setupVideo() {
    videoSfondo = document.getElementById('videoSfondo');
    textureSfondo = new THREE.VideoTexture(videoSfondo);
    textureSfondo.minFilter = THREE.LinearFilter;
    textureSfondo.magFilter = THREE.LinearFilter;
    playVideo();
}
function playVideo() {
    if (!videoSfondo) return;
    videoSfondo.play().catch(() => {
        console.log('Clicca sullo schermo per avviare il video');
    });
}

function createSphere() {
    const geometry = new THREE.SphereGeometry(sphereSize, 64, 64);
    const material = new THREE.MeshBasicMaterial({
        map: textureSfondo,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0
    });
    sphere = new THREE.Mesh(geometry, material);
    sphere.rotation.y = -Math.PI / 2;

    originalZ = sphere.rotation.z;

    sphere.position.y = sphereStartY;
    sphere.visible = false;

    scene.add(sphere);
}

// --- hover & mouse ---
function checkSphereHover() {
    if (!sphere || !sphere.visible) {
        window.isHoverSphere = false;
        return;
    }
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(sphere);
    window.isHoverSphere = intersects.length > 0;
}

function onDocumentMouseMove(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    const canvasX = event.clientX - rect.left;
    const canvasY = event.clientY - rect.top;

    mouse.x = (canvasX / rect.width) * 2 - 1;
    mouse.y = -(canvasY / rect.height) * 2 + 1;

    targetRotation.x = -mouse.y * 0.5;
    targetRotation.y = mouse.x * 0.5;

    checkSphereHover();
}

// --- scroll: mostra / nasconde sfera ---
function onScrollShowSphere() {
    if (window.scrollY > APPEAR_HEIGHT && !sphereVisible) {
        sphereVisible = true;
        appearProgress = 0;
        disappearProgress = 0;
        appearAnimatorStart();   // lancia l'animazione di apparizione (una sola volta finché rimane visibile)
        sphere.visible = true;
    } else if (window.scrollY < APPEAR_HEIGHT && sphereVisible) {
        sphereVisible = false;
        disappearProgress = 0;
        appearAnimatorCancel();
        clickAnimatorCancel();
        resetAfterDisappear();
    }
}

// --- click sulla sfera ---
function onClickScene(event) {
    if (!sphere || !sphere.visible) return;

    const rect = renderer.domElement.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    mouse.set(x, y);
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(sphere);

    if (intersects.length > 0) {
        // L'animazione del click deve partire SEMPRE dalla rotazione originale.
        // Interrompi qualsiasi clickAnimator in corso e resetta la rotazione a originalZ prima di partire.
        clickAnimatorStart({
            fromZ: originalZ,
            revolutions: 3,          // almeno 3 giri
            duration: 1500          // durata in ms (media)
        });

        window.scrollTo({ top: 0, behavior: "smooth" });
    }
}

// --- ANIMATOR: apparizione (1 giro lento, poi ritorno fluido alla originalZ) ---
function appearAnimatorStart() {
    appearAnimatorCancel(); // cancella se esiste
    if (!sphere) return;

    // se è già stata eseguita in questa visibilità, non la rilanciamo
    if (appearAnimator && appearAnimator.completed) return;

    const revolutions = 1;         // esattamente 1 giro
    const duration = 1800;         // ms, lento
    const startZ = sphere.rotation.z;
    const targetZ = originalZ + revolutions * Math.PI * 2;

    let startTime = null;
    let finished = false;

    appearAnimator = {
        requestId: null,
        completed: false,
        cancel() {
            if (this.requestId) cancelAnimationFrame(this.requestId);
            this.requestId = null;
        }
    };

    function step(timestamp) {
        if (!startTime) startTime = timestamp;
        const elapsed = timestamp - startTime;
        const t = Math.min(1, elapsed / duration);
        const easeT = appearEasing(t);

        // Interpola rotazione z da startZ -> targetZ using easing
        sphere.rotation.z = startZ + (targetZ - startZ) * easeT;

        if (t < 1) {
            appearAnimator.requestId = requestAnimationFrame(step);
        } else {
            // Alla fine, rientro fluido alla originalZ con un piccolo easing secondario
            // facciamo un breve tween di ritorno di 400ms con ease-out quad
            const settleDuration = 400;
            const settleStartZ = sphere.rotation.z;
            const settleStart = performance.now();
            function settleStep(now) {
                const el = now - settleStart;
                const tt = Math.min(1, el / settleDuration);
                // ease-out quad
                const easeOut = 1 - (1 - tt) * (1 - tt);
                sphere.rotation.z = settleStartZ + (originalZ - settleStartZ) * easeOut;
                if (tt < 1) {
                    appearAnimator.requestId = requestAnimationFrame(settleStep);
                } else {
                    // fine animazione: fissiamo alla originalZ esatta e segnaliamo completamento
                    sphere.rotation.z = originalZ;
                    appearAnimator.completed = true;
                    appearAnimator.requestId = null;
                }
            }
            appearAnimator.requestId = requestAnimationFrame(settleStep);
        }
    }

    appearAnimator.requestId = requestAnimationFrame(step);
}

function appearAnimatorCancel() {
    if (appearAnimator && appearAnimator.requestId) {
        cancelAnimationFrame(appearAnimator.requestId);
    }
    appearAnimator = null;
}

// --- ANIMATOR: click spin (parte SEMPRE da originalZ, almeno 3 giri, cubic-bezier(0.5,0,0.3,1)) ---
function clickAnimatorStart({ fromZ = originalZ, revolutions = 3, duration = 1500 } = {}) {
    clickAnimatorCancel();

    if (!sphere) return;

    // Force rotation start to originalZ (user requested always start from original)
    sphere.rotation.z = fromZ;

    const startZ = sphere.rotation.z;
    const targetZ = startZ + revolutions * 2 * Math.PI;
    const startTime = performance.now();

    let rafId = null;

    clickAnimator = {
        requestId: null,
        cancel() {
            if (rafId) cancelAnimationFrame(rafId);
            rafId = null;
        }
    };

    function step(now) {
        const elapsed = now - startTime;
        const t = Math.min(1, elapsed / duration);
        const easeT = clickEasing(t);

        sphere.rotation.z = startZ + (targetZ - startZ) * easeT;

        if (t < 1) {
            rafId = requestAnimationFrame(step);
            clickAnimator.requestId = rafId;
        } else {
            // Alla fine riportiamo fluidamente alla originalZ (breve settle)
            const settleDuration = 350;
            const settleStartZ = sphere.rotation.z;
            const settleStart = performance.now();
            function settleStep(now2) {
                const el = now2 - settleStart;
                const tt = Math.min(1, el / settleDuration);
                // ease-out cubic for settle
                const easeOut = 1 - Math.pow(1 - tt, 3);
                sphere.rotation.z = settleStartZ + (originalZ - settleStartZ) * easeOut;
                if (tt < 1) {
                    rafId = requestAnimationFrame(settleStep);
                    clickAnimator.requestId = rafId;
                } else {
                    sphere.rotation.z = originalZ;
                    clickAnimator.requestId = null;
                }
            }
            rafId = requestAnimationFrame(settleStep);
            clickAnimator.requestId = rafId;
        }
    }

    rafId = requestAnimationFrame(step);
    clickAnimator.requestId = rafId;
}

function clickAnimatorCancel() {
    if (clickAnimator && clickAnimator.requestId) {
        cancelAnimationFrame(clickAnimator.requestId);
    }
    clickAnimator = null;
}

// --- reset quando la sfera scompare ---
function resetAfterDisappear() {
    if (!sphere) return;
    // riportiamo tutto agli stati iniziali
    sphere.material.opacity = 0;
    sphere.position.y = sphereStartY;
    sphere.rotation.z = originalZ;
    sphere.visible = false;
    appearAnimator = null;
    clickAnimator = null;
}

// --- animazione principale ---
function animate() {
    requestAnimationFrame(animate);

    const elapsedTime = clock.getElapsedTime();

    if (sphere) {
        // Fade in / Fade out & posizione
        if (sphereVisible) {
            if (appearProgress < 1) appearProgress += 0.05;
            const t = appearProgress * appearProgress;
            sphere.material.opacity = t;
            sphere.position.y = sphereStartY + (sphereFinalY - sphereStartY) * t;
            // Note: la rotazione di apparizione è gestita da appearAnimator separato.
        } else {
            if (disappearProgress < 1) disappearProgress += 0.05;
            const t = 1 - disappearProgress;
            sphere.material.opacity = t;
            sphere.position.y = sphereStartY + (sphereFinalY - sphereStartY) * t;
            if (t <= 0) {
                sphere.visible = false;
            }
        }

        // Movimento controllato dal mouse (x/y)
        sphere.rotation.x += (targetRotation.x - sphere.rotation.x) * 0.1;
        let targetY = targetRotation.y - Math.PI / 2;
        sphere.rotation.y += (targetY - sphere.rotation.y) * 0.1;

        // Levita molto sottile
        const speed = 2;
        const amplitude = 0.1;
        sphere.position.y += Math.sin(elapsedTime * speed) * amplitude * 0.01;

        // Nota: rotazione z manipulata esclusivamente dagli animator per evitare conflitti
    }

    renderer.render(scene, camera);
}

// --- resize ---
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

window.addEventListener('DOMContentLoaded', init);
