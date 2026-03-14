const VIEW_SIZE = 1250;
const RADIUS = 545;
const POINT_COUNT = 12;
const CENTER = VIEW_SIZE / 2;

type Point = {
  x: number;
  y: number;
};

export function LogoMark({ size = 88 }: { size?: number }) {
  const points = polygonPoints(POINT_COUNT, CENTER, CENTER, RADIUS, -Math.PI / 2);

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${VIEW_SIZE} ${VIEW_SIZE}`}
      width={size}
      height={size}
      aria-hidden="true"
      className="brandLockup__logoCanvas"
    >
      <rect width="100%" height="100%" fill="none" />

      <circle cx={CENTER} cy={CENTER} r={RADIUS} fill="none" stroke="#00ff33" strokeWidth={4} />

      {points.flatMap((start, startIndex) =>
        points.slice(startIndex + 1).map((end, endIndex) => (
          <line
            key={`edge-${startIndex}-${endIndex}`}
            x1={start.x}
            y1={start.y}
            x2={end.x}
            y2={end.y}
            stroke="#00ff33"
            strokeWidth={2}
            strokeOpacity={0.95}
          />
        )),
      )}

      {points.map((point, index) => (
        <circle key={`point-${index}`} cx={point.x} cy={point.y} r={6.5} fill="#00ff33" />
      ))}
    </svg>
  );
}

function polygonPoints(pointCount: number, centerX: number, centerY: number, radius: number, startAngle: number): Point[] {
  const points: Point[] = [];

  for (let index = 0; index < pointCount; index += 1) {
    const angle = startAngle + (2 * Math.PI * index) / pointCount;
    points.push({
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
    });
  }

  return points;
}
