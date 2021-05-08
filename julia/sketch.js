let WIDTH, HEIGHT;
let NPIXELS = 10000;
let PX;
let PLANERAD0 = 2, PLANEWRAD0;
let PLANEWSPEED = 0.0005;

//let C_RE = -0.4, C_IM = 0.6;
//let N = 100;

//let C_RE = -0.8,
//  C_IM = 0.156;
let N = 150;

//let C_RE = -0.7269, C_IM = 0.1889;
//let N = 300;

let R_MAX = 10;

let ROTATE = false,
  ROTSPEED = 0.0001;

let planewrad;
let planeCenterRe = 0,
  planeCenterIm = 0;

let INSTRUCTION1 = 'Move cursor to control the appearance of the fractal.';
let INSTRUCTION2 = 'Click/touch and hold to zoom in, release to zoom out.';
let INSTRUCTION3 = '(The fractal is the "Julia set" for f(z) = z² - cursor.)';
let TEXTSIZE = 14, MAXTEXTWFRACT = 0.8;
let TEXTDISAPPTIME = 0.8, TEXTWAITTIME = 1;
let ALPHASPEED = 255 / TEXTDISAPPTIME;
let MINALPHA = -TEXTWAITTIME * ALPHASPEED;
let oldMouseX = 0,
  oldMouseY = 0,
  textAlpha = 255;

function setup() {
  createCanvas(400, 400);
  windowResized();
  planewrad = PLANEWRAD0;
  noStroke();
}

function windowResized() {
  WIDTH = windowWidth;
  HEIGHT = windowHeight;
  resizeCanvas(windowWidth, windowHeight);
  let pxArea = (WIDTH * HEIGHT) / NPIXELS;
  PX = Math.ceil(Math.sqrt(pxArea));
  // make sure PLANERAD0 of the number plane is visible in both Re and Im directions
  if (WIDTH <= HEIGHT) {
	PLANEWRAD0 = PLANERAD0; 
  } else {
	PLANEWRAD0 = WIDTH * PLANERAD0 / HEIGHT;  
  }
}

function x2Re(x) {
  return (planewrad * (x - WIDTH / 2)) / (WIDTH / 2) + planeCenterRe;
}

function y2Im(y) {
  return (-planewrad * (y - HEIGHT / 2)) / (WIDTH / 2) + planeCenterIm;
}

function draw() {
  //
  if (ROTATE) {
    let c_arg = Math.atan2(C_IM, C_RE);
    let c_mod = Math.sqrt(C_RE ** 2 + C_IM ** 2);
    c_arg += ROTSPEED * deltaTime;
    C_RE = c_mod * Math.cos(c_arg);
    C_IM = c_mod * Math.sin(c_arg);
  }
  // get position of mouse in imaginary number plane
  mouseRe = x2Re(mouseX);
  mouseIm = y2Im(mouseY);
  C_RE = mouseRe;
  C_IM = mouseIm;
  // adjust zoom of imaginary number plane
  let planewchange = PLANEWSPEED * planewrad * deltaTime;
  if (mouseIsPressed) {
    planewrad -= planewchange;
  } else {
    planewrad = min(PLANEWRAD0, planewrad + planewchange);
  }
  // adjust center so that mouse remains at same position in imaginary number plane
  newMouseRe = x2Re(mouseX);
  newMouseIm = y2Im(mouseY);
  planeCenterRe += mouseRe - newMouseRe;
  planeCenterIm += mouseIm - newMouseIm;
  // if mouse is not pressed, gravitate back toward origin
  if (planewrad == PLANEWRAD0) {
    planeCenterRe -= planeCenterRe * PLANEWSPEED * planewrad ** 2 * deltaTime;
    planeCenterIm -= planeCenterIm * PLANEWSPEED * planewrad ** 2 * deltaTime;
  }
  // calculate and plot
  let x, y, z_re, z_im, z_re_new, R, i, hue, lum;
  for (let x = 0; x < WIDTH; x += PX) {
    for (let y = 0; y < HEIGHT; y += PX) {
      z_re = x2Re(x);
      z_im = y2Im(y);
      for (i = 0; i < N; i++) {
        z_re_new = z_re ** 2 - z_im ** 2 + C_RE;
        z_im = 2 * z_re * z_im + C_IM;
        z_re = z_re_new;
        R = Math.sqrt(z_re ** 2 + z_im ** 2);
        if (R > R_MAX) {
          break;
        }
      }
      //fill(255 * min(N-i, N) / N);
      hue = Math.round(270 - (45 * min(i, N)) / N);
      lum = Math.round(0 + (100 * min(N - i, N)) / N);
      fill("hsl(" + hue + ", 100%, " + lum + "%)");
      square(x, y, PX);
    }
  }
  // plot cursor position
  push();
  fill("red");
  circle(mouseX, mouseY, 2);
  pop();
  // if zoomed out and no mouse movement, display instructions
  if (planewrad == PLANEWRAD0 && oldMouseX == mouseX && oldMouseY == mouseY) {
    textAlpha = min(255, textAlpha + ALPHASPEED * deltaTime / 1000);
  } else {
    textAlpha = max(MINALPHA, textAlpha - ALPHASPEED * deltaTime / 1000);
  }
  if (textAlpha > 0) {
    push();
    textSize(TEXTSIZE);
    let instrWidth = max(max(textWidth(INSTRUCTION1), textWidth(INSTRUCTION2)), textWidth(INSTRUCTION3));
    if (instrWidth > MAXTEXTWFRACT * WIDTH) {
      textSize(TEXTSIZE * MAXTEXTWFRACT * WIDTH / instrWidth);
    }
    let textColor = color('black');
    textColor.setAlpha(max(0, textAlpha));
    fill(textColor);
    textAlign(CENTER, TOP);
    text('\n' + INSTRUCTION1 + '\n' + INSTRUCTION2, WIDTH/2, 0)
    textColor.setAlpha(max(0, textAlpha) - 180);
	fill(textColor);
    text('\n\n\n\n' + INSTRUCTION3, WIDTH/2, 0)
    pop();
  }
  oldMouseX = mouseX;
  oldMouseY = mouseY;
}
