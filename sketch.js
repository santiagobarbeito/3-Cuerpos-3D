let spheres = [];
const numMovingSpheres = 3;
const centralSphereRadius = 50;
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

  carrier.freq(modulator1); // FM chain
  carrier.freq(modulator2);
  carrier.freq(modulator3);

  // Crear reverb una sola vez
  reverb = new p5.Reverb();
  reverb.process(carrier, 25, 0.6); // decay time, decay rate
  reverb.amp(1.5);
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

    let camX = sin(mouseX * 0.01) * zoomLevel;
    let camY = -sin(mouseY * 0.01) * zoomLevel;
    let camZ = cos(mouseX * 0.01) * zoomLevel;
    cam.setPosition(camX, camY, camZ);
    cam.lookAt(0, 0, 0);

    ambientLight(50);
    pointLight(125, 125, 125, 0, 0, 0);
    pointLight(50, 50, 50, 300, 300, 300);
    pointLight(50, 50, 50, -300, 300, 300);
    pointLight(50, 50, 50, 300, -300, 300);

    updateCentralSphereColor();
    for (let sphere of spheres) {
      sphere.update();
      sphere.display();
    }

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

    spheres.push(new Sphere(0, 0, 0, centralSphereRadius, color(255), false));

    for (let i = 0; i < numMovingSpheres; i++) {
      let radius = random(50, 50);
      let x = random(-250, 250);
      let y = random(-250, 250);
      let z = random(-250, 250);
      let c = [color(255, 0, 0), color(0, 255, 0), color(0, 0, 255)][i];
      spheres.push(new Sphere(x, y, z, radius, c, true));
    }

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

function updateCentralSphereColor() {
  let central = spheres[0];
  let r = 0, g = 0, b = 0;

  for (let i = 1; i < spheres.length; i++) {
    let s = spheres[i];
    let d = dist(central.position.x, central.position.y, central.position.z, s.position.x, s.position.y, s.position.z);
    let inf = map(d, 0, 500, 255, 0);
    if (s.color.levels[0] === 255) r += inf;
    if (s.color.levels[1] === 255) g += inf;
    if (s.color.levels[2] === 255) b += inf;
  }

  central.color = color(r, g, b);
}

function updateFMSynthesis() {
  if (spheres.length < 4) return;

  let [s0, s1, s2] = [spheres[1], spheres[2], spheres[3]];
  let d0 = dist(s0.position.x, s0.position.y, s0.position.z, 0, 0, 0);
  let d1 = dist(s1.position.x, s1.position.y, s1.position.z, 0, 0, 0);
  let d2 = dist(s2.position.x, s2.position.y, s2.position.z, 0, 0, 0);

  modulator1.freq(map(d0, 0, 500, carrierBaseFreq * 1.5, carrierBaseFreq * 3.5));
  modulator1.amp(map(s0.velocity.mag(), 0, 5, modMinDepth, modMaxDepth));

  modulator2.freq(map(d1, 0, 500, carrierBaseFreq / 1.5, carrierBaseFreq / 2.5));
  modulator2.amp(map(s1.velocity.mag(), 0, 5, modMinDepth, modMaxDepth));

  modulator3.freq(map(d2, 0, 500, carrierBaseFreq * 2.5, carrierBaseFreq * 4.5));
  modulator3.amp(map(s2.velocity.mag(), 0, 5, modMinDepth, modMaxDepth));

  // Pan dinámico
  let pan = map(s0.position.x, -width / 2, width / 2, -1, 1);
  carrier.pan(pan);

  // Omitimos recrear el reverb — ya está conectado
}

class Sphere {
  constructor(x, y, z, radius, col, isMoving) {
    this.position = createVector(x, y, z);
    this.velocity = createVector(0, 0, 0);
    this.acceleration = createVector(0, 0, 0);
    this.radius = radius;
    this.mass = radius;
    this.color = col;
    this.isMoving = isMoving;
    this.rotation = createVector(0, 0, 0);
  }

  applyGravity(other) {
    let G = 4;
    let force = p5.Vector.sub(other.position, this.position);
    let distanceSq = constrain(force.magSq(), 100, 10000);
    force.setMag((G * this.mass * other.mass) / distanceSq);
    this.acceleration.add(force.div(this.mass));
  }

  update() {
    if (this.isMoving) {
      this.applyGravity(spheres[0]);
      this.velocity.add(this.acceleration);
      this.position.add(this.velocity);
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
