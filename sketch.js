let spheres = [];
const numMovingSpheres = 3;
// const centralSphereRadius = 10; // ya no se usa
let cam;
let isMouseDragging = false;
let startX, startY;
let prevMouseX, prevMouseY;
const dragThreshold = 10;
let zoomLevel = 1500;
let reverb; // reverb global

// FM Synthesis Variables
let carrier;
let modulator1, modulator2, modulator3;
let carrierBaseFreq = 165;
let modMinDepth = -300;
let modMaxDepth = 300;

let startScreen = true;

// --- Nuevo: paneo 3D ---
let panner3D;

function preload() {
  font = loadFont('Staatliches-Regular.ttf');
}

function setup() {
  createCanvas(windowWidth, windowHeight, WEBGL);
  cam = createCamera();

  // Inicializar síntesis FM
  carrier = new p5.Oscillator('sine');
  modulator1 = new p5.Oscillator('sine');
  modulator2 = new p5.Oscillator('sine');
  modulator3 = new p5.Oscillator('sine');

  modulator1.disconnect();
  modulator2.disconnect();
  modulator3.disconnect();

  // Enlazamos los moduladores a la frecuencia del carrier (FM)
  carrier.freq(modulator1);
  carrier.freq(modulator2);
  carrier.freq(modulator3);

  // Crear reverb una sola vez
  reverb = new p5.Reverb();

  // --- Paneo 3D: conectar carrier a un panner 3D ---
  panner3D = new p5.Panner3D(); // HRTF por defecto
  carrier.disconnect();         // sacamos del master
  carrier.connect(panner3D);    // carrier -> panner3D -> master
  reverb.process(carrier, 25, 0.6);
  reverb.amp(1.5);
}

function drawConnectors() {
  if (spheres.length === 0) return;
  for (let s of spheres) {
    stroke(s.color);
    strokeWeight(2);
    line(0, 0, 0, s.position.x, s.position.y, s.position.z);
  }
  noStroke();
}

function draw() {
  if (startScreen) {
    background(0);
    fill(255);
    textSize(64);
    textFont(font);
    textAlign(CENTER, CENTER);
    text("Hacé click para empezar", 0, 0);
    textSize(32);
    text("Mové la cámara con el mouse", 0, 100);
    text("Zoom con flechas ↑ ↓", 0, 150);
  } else {
    background(0);

    // Zoom
    if (keyIsDown(UP_ARROW)) zoomLevel -= 10;
    if (keyIsDown(DOWN_ARROW)) zoomLevel += 10;

    // Órbita de cámara simple con el mouse
    let camX = sin(mouseX * 0.01) * zoomLevel;
    let camY = -sin(mouseY * 0.01) * zoomLevel;
    let camZ = cos(mouseX * 0.01) * zoomLevel;
    cam.setPosition(camX, camY, camZ);
    cam.lookAt(0, 0, 0);

    // Listener de audio ~ cámara
    updateAudioListener(camX, camY, camZ);

    // Luces
    ambientLight(50);
    pointLight(125, 125, 125, 0, 0, 0);
    pointLight(50, 50, 50, 300, 300, 300);
    pointLight(50, 50, 50, -300, 300, 300);
    pointLight(50, 50, 50, 300, -300, 300);

    // Colisiones
    resolveCollisions(spheres);

    // Física
    for (let s of spheres) s.update(spheres);

    // Paneo 3D según centro de masa
    updateCarrier3DPosition();

    // Render
    for (let s of spheres) s.display();

    // Audio FM
    updateFMSynthesis();
  }
}

function mousePressed() {
  if (startScreen) {
    carrier.amp(0.1);
    carrier.start();
    modulator1.start();
    modulator2.start();
    modulator3.start();

    spheres = [];
    for (let i = 0; i < numMovingSpheres; i++) {
      let radius = random(40, 60); // radio aleatorio 40..60
      let x = random(-500, 500);
      let y = random(-500, 500);
      let z = random(-500, 500);
      let c = [color(255, 0, 0), color(0, 255, 0), color(0, 0, 255)][i % 3];
      spheres.push(new Sphere(x, y, z, radius, c, true));
    }

    // (1) Colocar CM en el origen
    recenterToCenterOfMass(spheres);

    // (2) Asignar velocidades random(5) y balancear para P_total = 0
    setRandomVelocitiesAndZeroMomentum(spheres);

    startScreen = false;
  } else {
    startX = mouseX;
    startY = mouseY;
    isMouseDragging = false;
  }
}

function mouseReleased() {
  isMouseDragging = false;
}

function mouseDragged() {
  let dragDistance = dist(mouseX, mouseY, startX, startY);
  if (dragDistance > dragThreshold) {
    isMouseDragging = true;
  }
  prevMouseX = mouseX;
  prevMouseY = mouseY;
}

function updateFMSynthesis() {
  if (spheres.length < 3) return;

  let [s0, s1, s2] = [spheres[0], spheres[1], spheres[2]];
  let d0 = dist(s0.position.x, s0.position.y, s0.position.z, 0, 0, 0);
  let d1 = dist(s1.position.x, s1.position.y, s1.position.z, 0, 0, 0);
  let d2 = dist(s2.position.x, s2.position.y, s2.position.z, 0, 0, 0);

  modulator1.freq(map(d0, 0, 500, carrierBaseFreq * 1.5, carrierBaseFreq * 3.5));
  modulator1.amp(map(s0.velocity.mag(), 0, 5, modMinDepth, modMaxDepth));

  modulator2.freq(map(d1, 0, 500, carrierBaseFreq / 1.5, carrierBaseFreq / 2.5));
  modulator2.amp(map(s1.velocity.mag(), 0, 5, modMinDepth, modMaxDepth));

  modulator3.freq(map(d2, 0, 500, carrierBaseFreq * 2.5, carrierBaseFreq * 4.5));
  modulator3.amp(map(s2.velocity.mag(), 0, 5, modMinDepth, modMaxDepth));
}

class Sphere {
  constructor(x, y, z, radius, col, isMoving) {
    this.position = createVector(x, y, z);
    this.velocity = createVector(0, 0, 0); // luego se setea random en el setup
    this.acceleration = createVector(0, 0, 0);
    this.radius = radius;
    this.mass = radius; // masa proporcional al radio
    this.color = col;
    this.isMoving = isMoving;
    this.rotation = createVector(0, 0, 0);
  }

  // Gravedad mutua entre esferas (sin atracción al centro)
  applyGravityToOthers(allSpheres) {
    if (!allSpheres || allSpheres.length === 0) return;
    const G = 3;

    for (let other of allSpheres) {
      if (other === this) continue;
      let force = p5.Vector.sub(other.position, this.position);
      let r2 = constrain(force.magSq(), 200, 20000); // softening y límites numéricos
      let fMag = (G * this.mass * other.mass) / r2;
      force.setMag(fMag);
      if (force.mag() > 5) force.setMag(5); // estabilidad
      this.acceleration.add(p5.Vector.div(force, this.mass));

      // Separación suave si interpenetran
      let distBetween = p5.Vector.dist(this.position, other.position);
      let minDist = this.radius + other.radius;
      if (distBetween < minDist) {
        let repulsion = p5.Vector.sub(this.position, other.position);
        repulsion.setMag(0.5 * (minDist - distBetween));
        this.position.add(repulsion);
      }
    }
  }

  update(spheres) {
    if (this.isMoving) {
      this.applyGravityToOthers(spheres);
      this.velocity.add(this.acceleration);
      this.position.add(this.velocity);

      // Tope de velocidad
      const maxSpeed = 50;
      if (this.velocity.mag() > maxSpeed) {
        this.velocity.setMag(maxSpeed);
      }

      this.acceleration.mult(0);
      this.rotation.add(this.velocity.copy().mult(0.01));
    }
  }

  display() {
    push();
    translate(this.position.x, this.position.y, this.position.z);
    rotateX(this.rotation.x);
    rotateY(this.rotation.y);
    rotateZ(this.rotation.z);
    noStroke();
    fill(this.color);
    sphere(this.radius);
    pop();
  }
}

function resolveCollisions(spheres) {
  const restitution = 1; // 1 = elástico perfecto
  const posCorrectPct = 0.8;
  const slop = 0.01;

  for (let i = 0; i < spheres.length; i++) {
    for (let k = i + 1; k < spheres.length; k++) {
      const A = spheres[i], B = spheres[k];
      const n = p5.Vector.sub(B.position, A.position);
      const dist = n.mag();
      const minDist = A.radius + B.radius;

      if (dist >= minDist || dist === 0) continue;

      const normal = n.copy().div(dist);
      const penetration = minDist - dist;
      const invMassA = 1 / A.mass;
      const invMassB = 1 / B.mass;
      const correctionMag = max(penetration - slop, 0) / (invMassA + invMassB) * posCorrectPct;
      const correction = p5.Vector.mult(normal, correctionMag);
      A.position.sub(p5.Vector.mult(correction, invMassA));
      B.position.add(p5.Vector.mult(correction, invMassB));

      const rv = p5.Vector.sub(B.velocity, A.velocity);
      const velAlongNormal = rv.dot(normal);
      if (velAlongNormal > 0) continue;

      const impulseMag = -(1 + restitution) * velAlongNormal / (invMassA + invMassB);
      const impulse = p5.Vector.mult(normal, impulseMag);

      A.velocity.sub(p5.Vector.mult(impulse, invMassA));
      B.velocity.add(p5.Vector.mult(impulse, invMassB));
    }
  }
}

// --------- Centro de masa / momentum / audio helpers ----------
function recenterToCenterOfMass(sps) {
  // Computa CM ponderado por masa y traslada todas las posiciones
  let M = 0, cx = 0, cy = 0, cz = 0;
  for (let s of sps) {
    M += s.mass;
    cx += s.position.x * s.mass;
    cy += s.position.y * s.mass;
    cz += s.position.z * s.mass;
  }
  if (M === 0) return;
  cx /= M; cy /= M; cz /= M;
  for (let s of sps) s.position.sub(createVector(cx, cy, cz));
}

function setRandomVelocitiesAndZeroMomentum(sps) {
  // Asignar v_i ~ random(5) por eje y luego quitar V_CM para P_total=0
  for (let s of sps) {
    s.velocity.set(random(-3,3), random(-3,3), random(-3,3)); // como pediste: random(5) en cada eje
  }
  zeroTotalMomentum(sps);
}

function zeroTotalMomentum(sps) {
  // V_CM = (Σ m_i v_i) / M ; luego v_i' = v_i - V_CM
  let M = 0;
  let P = createVector(0, 0, 0);
  for (let s of sps) {
    M += s.mass;
    P.add(p5.Vector.mult(s.velocity, s.mass));
  }
  if (M === 0) return;
  const vCM = p5.Vector.div(P, M);
  for (let s of sps) s.velocity.sub(vCM);
}

function computeCenterOfMass(sps) {
  let M = 0, cx = 0, cy = 0, cz = 0;
  for (let s of sps) {
    M += s.mass;
    cx += s.position.x * s.mass;
    cy += s.position.y * s.mass;
    cz += s.position.z * s.mass;
  }
  if (M === 0) return {x:0,y:0,z:0};
  return { x: cx / M, y: cy / M, z: cz / M };
}

function updateCarrier3DPosition() {
  if (!panner3D || spheres.length === 0) return;
  const cm = computeCenterOfMass(spheres);
  if (typeof panner3D.set === 'function') {
    panner3D.set(cm.x, cm.y, cm.z);
  } else if (typeof panner3D.setPosition === 'function') {
    panner3D.setPosition(cm.x, cm.y, cm.z);
  }
}

function updateAudioListener(camX, camY, camZ) {
  const ac = getAudioContext && getAudioContext();
  if (!ac || !ac.listener) return;

  if (ac.listener.positionX) {
    const t = ac.currentTime;
    ac.listener.positionX.setValueAtTime(camX, t);
    ac.listener.positionY.setValueAtTime(camY, t);
    ac.listener.positionZ.setValueAtTime(camZ, t);
  } else if (ac.listener.setPosition) {
    ac.listener.setPosition(camX, camY, camZ);
  }

  let fx = -camX, fy = -camY, fz = -camZ;
  const len = Math.hypot(fx, fy, fz) || 1;
  fx /= len; fy /= len; fz /= len;
  const upx = 0, upy = 1, upz = 0;

  if (ac.listener.forwardX) {
    const t = ac.currentTime;
    ac.listener.forwardX.setValueAtTime(fx, t);
    ac.listener.forwardY.setValueAtTime(fy, t);
    ac.listener.forwardZ.setValueAtTime(fz, t);
    ac.listener.upX.setValueAtTime(upx, t);
    ac.listener.upY.setValueAtTime(upy, t);
    ac.listener.upZ.setValueAtTime(upz, t);
  } else if (ac.listener.setOrientation) {
    ac.listener.setOrientation(fx, fy, fz, upx, upy, upz);
  }
}
