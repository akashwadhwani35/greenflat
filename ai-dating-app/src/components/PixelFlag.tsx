import React from 'react';
import Svg, { Rect, Polygon, G } from 'react-native-svg';

type PixelFlagProps = {
  size?: number;
  color?: string;
};

export const PixelFlag: React.FC<PixelFlagProps> = ({
  size = 24,
  color = '#ADFF1A'
}) => {
  // Original viewBox is 83.14 x 84.15, scale proportionally
  const scale = size / 84.15;
  const width = 83.14 * scale;
  const height = size;

  return (
    <Svg width={width} height={height} viewBox="0 0 83.14 84.15">
      <G>
        {/* Flag pole */}
        <Rect
          fill={color}
          transform="matrix(0.357441 -0.115708 0.119612 0.391161 0 22.1236)"
          width="36.31"
          height="158.57"
        />
        {/* Top row pixels */}
        <Polygon fill={color} points="6.94,9.08 27.2,2.46 31.25,15.73 10.99,22.34" />
        <Polygon fill={color} points="25.42,8.7 45.67,2.09 49.73,15.35 29.47,21.97" />
        <Polygon fill={color} points="47.3,8.2 71.73,0 75.78,13.26 51.36,21.46" />
        <Polygon fill={color} points="58.75,4.41 71.72,0.21 83.14,37.53 70.16,41.73" />
        {/* Bottom row pixels */}
        <Polygon fill={color} points="14.99,46.85 35.24,40.23 39.3,53.5 19.04,60.12" />
        <Polygon fill={color} points="33.47,46.48 53.72,39.86 57.78,53.12 37.52,59.74" />
        <Polygon fill={color} points="55.35,45.97 71.88,40.42 75.94,53.69 59.41,59.24" />
      </G>
    </Svg>
  );
};
