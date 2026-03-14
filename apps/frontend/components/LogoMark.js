"use client";

import { useEffect, useRef } from "react";

const VIEW_SIZE = 1250;
const RADIUS = 545;
const POINT_COUNT = 12;
const ACCENT_INDICES = [0, 1, 2, 3, 5, 7, 9, 10];

export default function LogoMark() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const drawSize = 320;
    const devicePixelRatio = window.devicePixelRatio || 1;
    canvas.width = drawSize * devicePixelRatio;
    canvas.height = drawSize * devicePixelRatio;

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);

    const scale = (drawSize * devicePixelRatio) / VIEW_SIZE;
    context.setTransform(scale, 0, 0, scale, 0, 0);

    drawLogo(context);
  }, []);

  return <canvas ref={canvasRef} className="brandLockup__logoCanvas" aria-hidden="true" />;
}

function drawLogo(context) {
  const center = VIEW_SIZE / 2;
  const points = polygonPoints(POINT_COUNT, center, center, RADIUS, -Math.PI / 2);

  context.fillStyle = "#000000";
  context.fillRect(0, 0, VIEW_SIZE, VIEW_SIZE);

  context.strokeStyle = "#00ff33";
  context.lineWidth = 4;
  context.beginPath();
  context.arc(center, center, RADIUS, 0, Math.PI * 2);
  context.stroke();

  for (let start = 0; start < POINT_COUNT; start += 1) {
    for (let end = start + 1; end < POINT_COUNT; end += 1) {
      drawLine(context, points[start], points[end], "#00ff33", 2, 0.95);
    }
  }

  for (const index of ACCENT_INDICES) {
    drawLine(
      context,
      { x: center, y: center },
      points[index],
      "#00ff33",
      2.4,
      0.9
    );
  }

  for (const point of points) {
    context.save();
    context.fillStyle = "#00ff33";
    context.beginPath();
    context.arc(point.x, point.y, 6.5, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  context.save();
  context.fillStyle = "#00ff33";
  context.beginPath();
  context.arc(center, center, 5, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function polygonPoints(pointCount, centerX, centerY, radius, startAngle) {
  const points = [];
  for (let index = 0; index < pointCount; index += 1) {
    const angle = startAngle + (2 * Math.PI * index) / pointCount;
    points.push({
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle)
    });
  }
  return points;
}

function drawLine(context, start, end, color, width, opacity) {
  context.save();
  context.strokeStyle = color;
  context.lineWidth = width;
  context.globalAlpha = opacity;
  context.beginPath();
  context.moveTo(start.x, start.y);
  context.lineTo(end.x, end.y);
  context.stroke();
  context.restore();
}
