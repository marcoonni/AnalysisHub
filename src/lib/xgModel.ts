import { BodyPart, AssistType, DEFAULT_PITCH } from '../types';

/**
 * Calculates the distance from the shot position to the center of the goal.
 * Goal is at (0, 34) in our coordinate system (x=0 is goal line, y=34 is center).
 */
export const calculateDistance = (x: number, y: number): number => {
  const goalX = 0;
  const goalY = DEFAULT_PITCH.width / 2; // 34
  return Math.sqrt(Math.pow(x - goalX, 2) + Math.pow(y - goalY, 2));
};

/**
 * Calculates the angle (in radians) between the shot position and the two goalposts.
 * Goalposts are at (0, 34 - 3.66) and (0, 34 + 3.66).
 */
export const calculateAngle = (x: number, y: number): number => {
  const goalWidth = DEFAULT_PITCH.goalWidth;
  const goalCenterY = DEFAULT_PITCH.width / 2;
  const y1 = goalCenterY - goalWidth / 2;
  const y2 = goalCenterY + goalWidth / 2;

  const a = Math.sqrt(Math.pow(x, 2) + Math.pow(y - y1, 2));
  const b = Math.sqrt(Math.pow(x, 2) + Math.pow(y - y2, 2));
  const c = goalWidth;

  // Law of cosines: c^2 = a^2 + b^2 - 2ab*cos(theta)
  // cos(theta) = (a^2 + b^2 - c^2) / (2ab)
  const cosTheta = (Math.pow(a, 2) + Math.pow(b, 2) - Math.pow(c, 2)) / (2 * a * b);
  
  // Clamp to [-1, 1] to avoid NaN from floating point errors
  return Math.acos(Math.max(-1, Math.min(1, cosTheta)));
};

export interface XGCoefficients {
  beta0: number; // Intercept
  beta1: number; // Distance penalty
  beta2: number; // Angle bonus
  beta3Foot: number; // Foot bonus
  beta4Pass: number; // Pass bonus
  beta4Cross: number; // Cross bonus
  beta4Rebound: number; // Rebound bonus
}

export const DEFAULT_XG_COEFFICIENTS: XGCoefficients = {
  beta0: -1.2,
  beta1: -0.11,
  beta2: 1.6,
  beta3Foot: 0.8,
  beta4Pass: 0.4,
  beta4Cross: 0.2,
  beta4Rebound: 0.6,
};

/**
 * Calculates the xG (Expected Goals) for a shot.
 * Based on a logistic regression model.
 */
export const calculateXG = (
  x: number,
  y: number,
  bodyPart: BodyPart = 'foot',
  assistType: AssistType = 'none',
  coeffs: XGCoefficients = DEFAULT_XG_COEFFICIENTS
): number => {
  const dist = calculateDistance(x, y);
  const angle = calculateAngle(x, y);

  const beta3 = bodyPart === 'foot' ? coeffs.beta3Foot : 0;
  const beta4 = assistType === 'pass' ? coeffs.beta4Pass : 
                assistType === 'rebound' ? coeffs.beta4Rebound : 
                assistType === 'cross' ? coeffs.beta4Cross : 0;

  const logit = coeffs.beta0 + coeffs.beta1 * dist + coeffs.beta2 * angle + beta3 + beta4;
  const xg = 1 / (1 + Math.exp(-logit));

  // Round to 2 decimal places
  return Math.round(xg * 100) / 100;
};

/**
 * Generates a grid of xG values for the heat map.
 */
export const generateXGGrid = (
  rows: number = 17, 
  cols: number = 34, 
  coeffs: XGCoefficients = DEFAULT_XG_COEFFICIENTS
) => {
  const grid = [];
  const cellHeight = DEFAULT_PITCH.height / rows;
  const cellWidth = DEFAULT_PITCH.width / cols;

  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < cols; c++) {
      // Calculate center of cell
      const x = (r + 0.5) * cellHeight;
      const y = (c + 0.5) * cellWidth;
      row.push(calculateXG(x, y, 'foot', 'none', coeffs));
    }
    grid.push(row);
  }
  return grid;
};
