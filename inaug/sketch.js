

// scene control
let t = 0;
let paused = false;
let scene = 0;
const maxScene = 6;
const timeGraceForPrevScene = 2;
let hasUpdatedScene = false;
// screen size
const referenceScreenWidth = 1240, axisLabelRefFontSize = 32;
let screenScaleFactor;
// optic flow points
let pts = [];
const n_pts = 1000, maxPtDist = 200;
// perspective
const eyeHeight = 1.5, horizonPitch = eyeHeight / (2 * maxPtDist);
const fovYaw = 35 * 3.14159 / 180;
let fovPitch;
// vehicle control
let steeringEnabled = true;
const acc = 100, maxV = 50;
const steerDeadZone = 0.1, maxCurvature = 0.02; // YawRate = 30 * 3.14159 / 180;
let pos;
let v = 0, yaw = 0;
// road
let showRoad = false;
const roadHalfWidth = 3.5;
const roadDeltaX = [maxPtDist*1.5, 20];
const roadY = [-roadHalfWidth, roadHalfWidth, roadHalfWidth, -roadHalfWidth];
// near/far sight points
let showNearFarPoints = false;
const roadPointPrevTimes = [0.3, 2];
let roadPointPlotPos = [0, 0];
let roadPointPlotXdots = [0, 0];
// obstacle
let showObstacle = false;
let obstacleDist = 200;
let obstacleHalfWidth = 1;
let obstacleHeight = 2;
let obstacleAbsPts;
let stopAtObstacle = true, obstacleStopDistance = 7;
// looming plot
let showLoomingPlot = false;
let loomingTimeSeries, loomingPlot;
let obstaclePlotWidth, relativeOpticalExpansion;
// evidence accumulation
let showEvidenceAccPlots = false;
let evidencePlot;
let nEvidenceTraces = 50;
let loomAccK = 0.08, loomAccM = 0.01, loomAccSigma = 0.05;



// classes

class TimeSeriesData {
  constructor(maxTime=100000, minTimeDelta=0) {
    this.maxTime = maxTime;
    this.minTimeDelta = minTimeDelta;
    this.times = [];
    this.values = [];
    this.length = 0;
    // this.minValue = 1000000;
    // this.maxValue = -1000000;
  }
  addDataPoint(time, value) {
    if ((time <= this.maxTime) & ((this.times.length == 0) | (time > this.times.at(-1) + this.minTimeDelta))) {
      this.times.push(time);
      this.values.push(value);
      this.length++;
      // this.minValue = min(this.minValue, value);
      // this.maxValue = max(this.maxValue, value);
    }
  }
}

class Box {
  constructor(minX, maxX, minY, maxY) {
    this.minX = minX,
    this.maxX = maxX;
    this.minY = minY;
    this.maxY = maxY;
    this.xRange = maxX - minX;
    this.yRange = maxY - minY;
  }
  isInXRange(x) {
    return (x >= this.minX) & (x <= this.maxX)
  }
  isInYRange(y) {
    return (y >= this.minY) & (x <= this.maxY)
  }
  isInside(x, y) {
    return this.isInXRange(x) & this.isInXRange(y);
  }
}

class Plot {
  constructor(relScrBox, dataBox, xLabel='', yLabel='', relStrokeWeight=2, relArrowHeadSize=8) {
    this.relScrBox = relScrBox;
    this.dataBox = dataBox;
    this.xLabel = xLabel;
    this.yLabel = yLabel;
    this.relStrokeWeight = relStrokeWeight;
    this.relArrowHeadSize = relArrowHeadSize;
  }
  getScreenPos(dataX, dataY) {
    return createVector(
      width * (this.relScrBox.minX + this.relScrBox.xRange * (dataX - this.dataBox.minX) / this.dataBox.xRange), 
      height * (this.relScrBox.minY + this.relScrBox.yRange * (1 - (dataY - this.dataBox.minY) / this.dataBox.yRange)));
  }
  drawAxes() {
    let leftBottom = this.getScreenPos(this.dataBox.minX, this.dataBox.minY);
    let rightBottom = this.getScreenPos(this.dataBox.maxX, this.dataBox.minY);
    let leftTop = this.getScreenPos(this.dataBox.minX, this.dataBox.maxY);
    drawArrow(leftBottom.x, leftBottom.y, rightBottom.x, rightBottom.y, this.relStrokeWeight, this.relArrowHeadSize);
    drawArrow(leftBottom.x, leftBottom.y, leftTop.x, leftTop.y, this.relStrokeWeight, this.relArrowHeadSize);
    push();
    strokeWeight(0);
    textAlign(LEFT);
    text(" " + this.xLabel, rightBottom.x, rightBottom.y)
    textAlign(RIGHT);
    text(this.yLabel + " ", leftTop.x, leftTop.y)
    pop();
  }
}

class TimeSeriesPlot extends Plot {
  constructor(relScrBox, dataBox, xLabel='', yLabel='') {
    super(relScrBox, dataBox, xLabel, yLabel);
    this.timeSeriesList = [];
  }
  addTimeSeries(timeSeries) {
    this.timeSeriesList.push(timeSeries);
  }
  draw() {
    strokeWeight(this.relStrokeWeight * screenScaleFactor);
    for (let ts = 0; ts < this.timeSeriesList.length; ts++) {
      let timeSeries = this.timeSeriesList[ts];
      let prevPt, hasPrevPt = false;
      for(let i = 0; i < timeSeries.length; i++) {
        let thisPtInRange = this.dataBox.isInside(timeSeries.times[i], timeSeries.values[i]);
        let thisPt = this.getScreenPos(timeSeries.times[i], timeSeries.values[i]);
        if (hasPrevPt & thisPtInRange)
          line(prevPt.x, prevPt.y, thisPt.x, thisPt.y);
        if (thisPtInRange) {
          prevPt = thisPt;
          hasPrevPt = true;
        } else
          hasPrevPt = false;
      }
    }
  }
}

class Histogram extends Plot {
  constructor(relScrBox, dataBox, binWidth, xLabel='', yLabel='') {
    super(relScrBox, dataBox, xLabel, yLabel)
    this.binWidth = binWidth;
    this.nBins = ceil(dataBox.xRange / binWidth);
    this.binCounts = [];
    for (i = 0; i < this.nBins; i++) {
      this.binCounts.push(0);
    }
  }
  addData(value) {
    if (this.dataBox.isInXRange(value)) {
      let iBin = floor(value / this.binWidth)
      this.binCounts[iBin]++;
    }
  }
  draw() {
    for (i = 0; i < this.nBins; i++) {
      let leftTop = this.getScreenPos(this.dataBox.minX + i * this.binWidth, this.binCounts[i]);
      let rightBottom = this.getScreenPos(this.dataBox.minX + (i+1) * this.binWidth, 0);
      rect(leftTop.x, leftTop.y, rightBottom.x, rightBottom.y)
    }
  }
}


// helper functions

function setFovPitch() {
   fovPitch = fovYaw * windowHeight / windowWidth;
}

function getRandomPos(minPtDist) {
  return createVector(random(minPtDist, maxPtDist), random(-100, 100)).rotate(yaw).add(pos);
}

function initialiseScene() {
  // housekeeping
  t = 0;
  hasUpdatedScene = false;
  paused = false;
  // initialise vehicle
  pos = createVector(0, 0, eyeHeight);
  v = 0;
  yaw = 0;
  // set up this scene
  steeringEnabled = true;
  showRoad = true;
  showNearFarPoints = false;
  showObstacle = false;
  obstacleDist = 200;
  showLoomingPlot = false;
  showEvidenceAccPlots = false;
  switch(scene){
    case 0:
      showRoad = false;
      break;
    case 1:
      v = maxV;
      break;
    case 2:
      v = maxV;
      showNearFarPoints = true;
      break;
    case 3:
      steeringEnabled = false;
      showObstacle = true;
      break;
    case 4:
      v = maxV;
      steeringEnabled = false;
      showObstacle = true;
      showLoomingPlot = true;
      break;
    case 5:
      v = maxV;
      steeringEnabled = false;
      showObstacle = true;
      showLoomingPlot = true;
      showEvidenceAccPlots = true;
      break;
    case 6:
      v = maxV;
      steeringEnabled = false;
      showObstacle = true;
      obstacleDist = 50;
      showLoomingPlot = true;
      showEvidenceAccPlots = true;
      break;
  }
  // intialise optic flow points
  pts = [];
  for(let i = 0; i < n_pts; i++) {
    pts.push(getRandomPos(0));
  }
  // initialise obstacle
  obstacleAbsPts = [];
  obstacleAbsPts.push(createVector(obstacleDist, obstacleHalfWidth, 0));
  obstacleAbsPts.push(createVector(obstacleDist, obstacleHalfWidth, obstacleHeight * .6));
  obstacleAbsPts.push(createVector(obstacleDist, obstacleHalfWidth * .6, obstacleHeight));
  obstacleAbsPts.push(createVector(obstacleDist, -obstacleHalfWidth * .6, obstacleHeight));
  obstacleAbsPts.push(createVector(obstacleDist, -obstacleHalfWidth, obstacleHeight * .6));
  obstacleAbsPts.push(createVector(obstacleDist, -obstacleHalfWidth, 0));
  obstacleAbsPts.push(createVector(obstacleDist, -obstacleHalfWidth * .65, 0));
  obstacleAbsPts.push(createVector(obstacleDist, -obstacleHalfWidth * .65, obstacleHeight * .15));
  obstacleAbsPts.push(createVector(obstacleDist, obstacleHalfWidth * .65, obstacleHeight * .15));
  obstacleAbsPts.push(createVector(obstacleDist, obstacleHalfWidth * .65, 0));
  // initialise time series and plots
  loomingPlot = new TimeSeriesPlot(new Box(0.05, 0.3, 0.05, 0.25), new Box(0, 4, 0, 5), '𝑡', '𝛽');
  loomingTimeSeries = new TimeSeriesData(maxTime=10);
  loomingPlot.addTimeSeries(loomingTimeSeries);
  evidencePlot = new TimeSeriesPlot(new Box(0.7, 0.95, 0.25, 0.40), new Box(0, 3, 0, 1), '𝑡', '𝑥')
  for(i = 0; i < nEvidenceTraces; i++) 
    evidencePlot.addTimeSeries(new TimeSeriesData(maxTime=10));
  rtPlot = new Histogram(new Box(0.7, 0.95, 0.05, 0.18), new Box(0, 3, 0, 30), 0.25, '𝑡', '#')
  
}

function getRelPos(worldX, worldY, worldZ=0) {
  return createVector(worldX, worldY, worldZ).sub(pos).rotate(-yaw)
}

function projectPoint(relPt) {
  let z;
  if ('z' in relPt) {
    z = relPt.z;
  } else {
    z = -eyeHeight;
  }
  ptYaw = relPt.y / relPt.x;
  ptPitch = -z / relPt.mag();
  return createVector((width/2) * (1 + ptYaw / fovYaw), 
                      (height/2) * (1 + ptPitch / fovPitch));
}


// drawing functions

function drawArrow(x1, y1, x2, y2, relStrokeWeight, relHeadSize) {
  strokeWeight(relStrokeWeight * screenScaleFactor);
  headSize = relHeadSize * screenScaleFactor;
  line(x1, y1, x2, y2);
  angle = Math.atan2(y2 - y1, x2 - x1);
  for(let delta = -1; delta <= 1; delta += 2) {
    thisAngle = angle + delta * 135 * PI / 180;
    line(x2, y2, x2 + headSize * cos(thisAngle), y2 + headSize * sin(thisAngle))
  }
}


// p5.js events

function windowResized() {
   resizeCanvas(windowWidth, windowHeight);
   setFovPitch();
   screenScaleFactor = width / referenceScreenWidth;
   textSize(screenScaleFactor * axisLabelRefFontSize);
}

function keyPressed() {
  if ((keyCode === LEFT_ARROW) | (keyCode === RIGHT_ARROW) ) {
    if (keyCode === RIGHT_ARROW) 
      if (scene < maxScene) 
        scene++;
      else
        return;
    else if (keyCode === LEFT_ARROW) 
      if (t < timeGraceForPrevScene)
        scene = max(0, scene-1);
    initialiseScene();
  }
  else if (key === 'p') 
    paused = !paused;
}


// core p5.js functions

function setup() {
  createCanvas(windowWidth, windowHeight);
  windowResized()
  initialiseScene();
  rectMode(CORNERS);
}

function draw() {
  if (paused)
    return;
  let dt = deltaTime / 1000;
  t += dt;
  // steering control
  if (steeringEnabled) {
    let steerPos = (mouseX - width/2) / (width/2);
    if (abs(steerPos) > steerDeadZone) {
      let absSteerPos = (abs(steerPos) - steerDeadZone) * (1 - steerDeadZone);
      let curvature = maxCurvature * absSteerPos * Math.sign(steerPos);
      yaw += v * curvature * dt;
    }
  }
  // speed control
  if (mouseIsPressed) {
    let deltaV = acc * dt;
    if (mouseButton === LEFT)
      v = min(v + deltaV, maxV);
    else
      v = max(v - deltaV, 0);
  }
  // ego position update
  pos.add(v * cos(yaw) * dt, v * sin(yaw) * dt);
  // draw background
  background(220);
  fill(0, 100, 0);
  // - ground plane
  strokeWeight(0);
  rect(0, height/2 * (1 + horizonPitch / fovPitch), width, height);
  // - road
  if (showRoad) {
    roadPts = [];
    for(let side = -1; side <= 1; side += 2) {
      sideRoadPts = [];
      for(let i = 0; i < 2; i++) {
        let relPt = getRelPos(pos.x + roadDeltaX[i], side * roadHalfWidth); 
        sideRoadPts.push(projectPoint(relPt));
      }
      let nearRoadPt = sideRoadPts[1].copy().add(sideRoadPts[1].copy().sub(sideRoadPts[0]).mult(4))
      sideRoadPts.push(nearRoadPt);
      roadPts.push(sideRoadPts);
    }
    fill(80);
    beginShape();
    vertex(roadPts[0][0].x, roadPts[0][0].y);
    vertex(roadPts[0][1].x, roadPts[0][1].y);
    vertex(roadPts[0][2].x, roadPts[0][2].y);
    vertex(roadPts[1][2].x, roadPts[1][2].y);
    vertex(roadPts[1][1].x, roadPts[1][1].y);
    vertex(roadPts[1][0].x, roadPts[1][0].y);
    endShape();
  }
  // draw optic flow points
  for(let i = 0; i < n_pts; i++) {
    let relPt = getRelPos(pts[i].x, pts[i].y); 
    let pt = projectPoint(relPt);
    if (pt.x < 0 | pt.x > width | pt.y < 0 | pt.y > height | relPt.x < 0) 
      pts[i] = getRandomPos(80);
    else
      strokeWeight(max(1, 150 / relPt.mag()))
      stroke(255, 255, 255, 100);
      point(pt.x, pt.y);
  }
  // near/far points
  for(let i = 0; i < 2; i++) {
    ptDistance = roadPointPrevTimes[i] * v;
    let thisRoadPtPlotPos = projectPoint(getRelPos(pos.x + ptDistance, 0));
    roadPointPlotXdots[i] = (thisRoadPtPlotPos.x - roadPointPlotPos[i].x) / dt;
    roadPointPlotPos[i] = thisRoadPtPlotPos;
    if (showNearFarPoints) {
      strokeWeight(5);
      stroke('red');
      drawArrow(roadPointPlotPos[i].x, roadPointPlotPos[i].y, 
        roadPointPlotPos[i].x + roadPointPlotXdots[i], roadPointPlotPos[i].y, 5, 10)
    }
  }
  // obstacle
  let minObstaclePlotX = 10000, maxObstaclePlotX = -10000;
  if (showObstacle & (pos.x < obstacleDist)) {
    fill('blue');
    strokeWeight(0);
    beginShape();
    for(let i = 0; i < obstacleAbsPts.length; i++) {
      let obstacleRelPos = getRelPos(obstacleAbsPts[i].x, obstacleAbsPts[i].y, obstacleAbsPts[i].z);
      let obstaclePlotPos = projectPoint(obstacleRelPos);
      vertex(obstaclePlotPos.x, obstaclePlotPos.y);
      minObstaclePlotX = min(minObstaclePlotX, obstaclePlotPos.x);
      maxObstaclePlotX = max(maxObstaclePlotX, obstaclePlotPos.x);
    }
    endShape()
    if (stopAtObstacle & pos.x > obstacleDist - obstacleStopDistance) {
      v = 0;
    }
  }
  // looming plot
  if (showLoomingPlot) {
    // calculate and log the looming
    let currObstaclePlotWidth = maxObstaclePlotX - minObstaclePlotX;
    if (hasUpdatedScene & v > 0) {
      let obstaclePlotWidthRate = (currObstaclePlotWidth - obstaclePlotWidth) / dt;
      relativeOpticalExpansion = obstaclePlotWidthRate / obstaclePlotWidth
      loomingTimeSeries.addDataPoint(t, relativeOpticalExpansion);
    }
    obstaclePlotWidth = currObstaclePlotWidth;
    // draw the plot
    strokeWeight(2);
    stroke('black');
    fill('black')
    loomingPlot.drawAxes()
    loomingPlot.draw();
  }
  // evidence accumulation plots
  if (showEvidenceAccPlots) {
    if (hasUpdatedScene) {
      deltaEvidence = loomAccK * relativeOpticalExpansion - loomAccM;
      for(i = 0; i < nEvidenceTraces; i++) {
        thisTimeSeries = evidencePlot.timeSeriesList[i];
        if (thisTimeSeries.length == 0 | thisTimeSeries.values.at(-1) < 1) {
          let thisDeltaEvidence = deltaEvidence + randomGaussian(0, loomAccSigma)
          if (thisTimeSeries.length == 0)
            newEvidence = max(0, thisDeltaEvidence);
          else
            newEvidence = max(0, thisTimeSeries.values.at(-1) + thisDeltaEvidence);
          thisTimeSeries.addDataPoint(t, newEvidence);
          if (newEvidence >= 1)
            rtPlot.addData(t);
        }
      }
    }
    strokeWeight(2);
    stroke(0, 0, 0, 10);
    evidencePlot.draw();
    stroke('black');
    evidencePlot.drawAxes();
    fill('blue');
    rtPlot.draw();
    fill('black')
    rtPlot.drawAxes();
  }
  // remember that we've completed at least one update
  hasUpdatedScene = true;
}
