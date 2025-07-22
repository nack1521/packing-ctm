export enum RotationType {
  RT_WHD = 0,
  RT_HWD = 1,
  RT_HDW = 2,
  RT_DHW = 3,
  RT_DWH = 4,
  RT_WDH = 5,
}

export enum Axis {
  WIDTH = 0,
  HEIGHT = 1,
  DEPTH = 2,
}

export const ALL_ROTATIONS = [
  RotationType.RT_WHD,
  RotationType.RT_HWD,
  RotationType.RT_HDW,
  RotationType.RT_DHW,
  RotationType.RT_DWH,
  RotationType.RT_WDH,
];

export const NO_UPDOWN_ROTATIONS = [
  RotationType.RT_WHD,
  RotationType.RT_HWD,
];
