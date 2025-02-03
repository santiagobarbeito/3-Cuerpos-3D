let spheres = [];
const numMovingSpheres = 3;
const centralSphereRadius = 50;
let cam;
let isMouseDragging = false;
let startX, startY;
let prevMouseX, prevMouseY;
const dragThreshold = 10; // Minimum distance to start dragging
let zoomLevel = 1500; // Start more zoomed out

// FM Synthesis Variables
let carrier;
let modulator1, modulator2, modulator3;
let carrierBaseFreq = 165;
let modMinFreq = 0;
let modMaxFreq = 300;
let modMinDepth = -300;
let modMaxDepth = 300;

let startScreen = true; // Flag to determine if the start screen is displayed

function preload() {
  font = loadFont('Staatliches-Regular.ttf');
}

function setup() {
  createCanvas(windowWidth, windowHeight, WEBGL);
  cam = createCamera();

  // Initialize FM synthesis variables
  carrier = new p5.Oscillator('sine');
  modulator1 = new p5.Oscillator('sine');
  modulator2 = new p5.Oscillator('sine');
  modulator3 = new p5.Oscillator('sine');

  // Disconnect oscillators to avoid audio issues
  modulator1.disconnect();
  modulator2.disconnect();
  modulator3.disconnect();
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
    text("Podes mover la camara moviendo el mouse", 0, 100);
    text("y hacer zoom in y zoom out con las flechitas", 0, 150);
  } else {
    background(0);

    // Handle zoom in and out
    if (keyIsDown(UP_ARROW)) {
      zoomLevel -= 10; // Zoom in
    }
    if (keyIsDown(DOWN_ARROW)) {
      zoomLevel += 10; // Zoom out
    }

    // Update camera position based on zoom level and mouse drag
    let camX = sin(mouseX * 0.01) * zoomLevel;
    let camY = -sin(mouseY * 0.01) * zoomLevel;
    let camZ = cos(mouseX * 0.01) * zoomLevel;

    cam.setPosition(camX, camY, camZ);
    cam.lookAt(0, 0, 0);

    // Set up lighting
    ambientLight(50, 50, 50); // Dim ambient light
    pointLight(125, 125, 125, 0, 0, 0); // Point light at the center

    // Add a few additional lights around the central sphere
    pointLight(50, 50, 50, 300, 300, 300); // Light 1
    pointLight(50, 50, 50, -300, 300, 300); // Light 2
    pointLight(50, 50, 50, 300, -300, 300); // Light 3

    // Apply gravitational forces and update all spheres
    for (let i = 0; i < spheres.length; i++) {
      for (let j = i + 1; j < spheres.length; j++) {
        if (spheres[i].isMoving || spheres[j].isMoving) {
          spheres[i].applyGravity(spheres[j]);
          spheres[j].applyGravity(spheres[i]);
        }
      }
    }

    // Update and display all spheres
    updateCentralSphereColor();
    for (let sphere of spheres) {
      sphere.update();
      sphere.display();
    }

    // Update FM synthesis parameters based on sphere properties
    updateFMSynthesis();
  }
}

function mousePressed() {
  if (startScreen) {
    // Initialize audio
    carrier.amp(0.0625);
    carrier.freq(carrierBaseFreq);
    carrier.start();

    modulator1.start();
    modulator2.start();
    modulator3.start();

    modulator1.disconnect();
    carrier.freq(modulator1);
    modulator2.disconnect();
    carrier.freq(modulator2);
    modulator3.disconnect();
    carrier.freq(modulator3);

    // Optional: Add reverb effect
    let reverb = new p5.Reverb();
    reverb.process(carrier, 6, 0.2);
    reverb.amp(0.75);

    // Create the central sphere
    spheres.push(new Sphere(0, 0, 0, centralSphereRadius, color(255, 255, 255), false));

    // Create three moving spheres with random positions, radii, and colors
    for (let i = 0; i < numMovingSpheres; i++) {
      let radius = random(20, 50);
      let x = random(-500, 500);
      let y = random(-500, 500);
      let z = random(-500, 500);
      let c;
      switch (i) {
        case 0:
          c = color(255, 0, 0);
          break; // Red
        case 1:
          c = color(0, 255, 0);
          break; // Green
        case 2:
          c = color(0, 0, 255);
          break; // Blue
      }
      spheres.push(new Sphere(x, y, z, radius, c, true));
    }

    // Switch off the start screen
    startScreen = false;
  } else {
    startX = mouseX;
    startY = mouseY;
    isMouseDragging = false; // Default to not dragging until confirmed
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
  let centralSphere = spheres[0];
  let r = 0;
  let g = 0;
  let b = 0;

  // Calculate influence of each moving sphere on the central sphere's color
  for (let i = 1; i < spheres.length; i++) {
    let distance = dist(
      centralSphere.position.x,
      centralSphere.position.y,
      centralSphere.position.z,
      spheres[i].position.x,
      spheres[i].position.y,
      spheres[i].position.z
    );
    let influence = map(distance, 0, 500, 255, 0); // Modify this range as needed
    if (spheres[i].color.levels[0] === 255) r += influence;
    if (spheres[i].color.levels[1] === 255) g += influence;
    if (spheres[i].color.levels[2] === 255) b += influence;
  }

  // Set the new color of the central sphere
  centralSphere.color = color(r, g, b);
}

function updateFMSynthesis() {
  if (spheres.length < 4) return; // Ensure there are enough spheres

  let sphere0 = spheres[1]; // Red sphere
  let sphere1 = spheres[2]; // Green sphere
  let sphere2 = spheres[3]; // Blue sphere

  let modFreq1 = map(sphere0.position.y, -height / 2, height / 2, carrierBaseFreq * 1.5, carrierBaseFreq * 2.5);
  let modDepth1 = map(sphere0.radius, 20, 50, modMinDepth, modMaxDepth);
  modulator1.freq(modFreq1);
  modulator1.amp(modDepth1);

  let modFreq2 = map(sphere1.position.y, -height / 2, height / 2, carrierBaseFreq / 1.5, carrierBaseFreq / 2.5);
  let modDepth2 = map(sphere1.radius, 20, 50, modMinDepth, modMaxDepth);
  modulator2.freq(modFreq2);
  modulator2.amp(modDepth2);

  let modFreq3 = map(sphere2.position.y, -height / 2, height / 2, carrierBaseFreq * 2.5, carrierBaseFreq * 3.5);
  let modDepth3 = map(sphere2.radius, 20, 50, modMinDepth, modMaxDepth);
  modulator3.freq(modFreq3);
  modulator3.amp(modDepth3);
}

class Sphere {
  constructor(x, y, z, radius, col, isMoving) {
    this.position = createVector(x, y, z);
    this.velocity = createVector(0, 0, 0);
    this.acceleration = createVector(0, 0, 0);
    this.radius = radius;
    this.mass = radius; // Mass is equal to the radius
    this.color = col;
    this.isMoving = isMoving;
    this.rotation = createVector(random(TWO_PI), random(TWO_PI), random(TWO_PI)); // Initial rotation vector
    this.spin = createVector(random(-0.05, 0.05), random(-0.05, 0.05), random(-0.05, 0.05)); // Spin speed
  }

  applyGravity(other) {
    let G = 4; // Increased gravitational constant
    let force = p5.Vector.sub(other.position, this.position);
    let distanceSq = constrain(force.magSq(), 100, 10000); // Avoid division by zero
    let strength = (G * this.mass * other.mass) / distanceSq;
    force.setMag(strength);
    this.acceleration.add(force.div(this.mass));
  }

  update() {
    if (this.isMoving) {
      // Apply gravity from other spheres
      this.velocity.add(this.acceleration);
      this.position.add(this.velocity);

      // Clear acceleration
      this.acceleration.mult(0);

      // Update rotation based on spin
      this.rotation.add(this.spin);
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
    
    // Add visual indicator of rotation
    stroke(255);
    line(0, 0, 0, this.radius, 0, 0); // Line indicating rotation
    pop();
  }
}

