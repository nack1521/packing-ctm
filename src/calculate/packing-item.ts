import { RotationType, ALL_ROTATIONS, NO_UPDOWN_ROTATIONS } from './constants';
import { set2Decimal } from './utils';

export class PackingItem {
  partno: string;
  name: string;
  itemType: string;
  width: number;
  height: number;
  depth: number;
  weight: number;
  level: number;
  loadbear: number;
  updown: boolean;
  color: string;
  rotation_type: RotationType;
  position: [number, number, number];
  number_of_decimals: number;

  constructor(
    partno: string,
    name: string,
    itemType: string,
    WHD: [number, number, number],
    weight: number,
    level: number,
    loadbear: number,
    updown: boolean,
    color: string
  ) {
    this.partno = partno;
    this.name = name;
    this.itemType = itemType;
    this.width = WHD[0];
    this.height = WHD[1];
    this.depth = WHD[2];
    this.weight = weight;
    this.level = level;
    this.loadbear = loadbear;
    this.updown = itemType === 'cube' ? updown : false;
    this.color = color;
    this.rotation_type = RotationType.RT_WHD;
    this.position = [0, 0, 0];
    this.number_of_decimals = 0;
  }

  formatNumbers(number_of_decimals: number): void {
    this.width = set2Decimal(this.width, number_of_decimals);
    this.height = set2Decimal(this.height, number_of_decimals);
    this.depth = set2Decimal(this.depth, number_of_decimals);
    this.weight = set2Decimal(this.weight, number_of_decimals);
    this.number_of_decimals = number_of_decimals;
  }

  string(): string {
    return `${this.partno}(${this.width}x${this.height}x${this.depth}, weight: ${this.weight}) pos(${this.position}) rt(${this.rotation_type}) vol(${this.getVolume()})`;
  }

  getVolume(): number {
    return set2Decimal(this.width * this.height * this.depth, this.number_of_decimals);
  }

  getMaxArea(): number {
    const dimensions = this.updown 
      ? [this.width, this.height, this.depth].sort((a, b) => b - a)
      : [this.width, this.height, this.depth];
    
    return set2Decimal(dimensions[0] * dimensions[1], this.number_of_decimals);
  }

  getDimension(): [number, number, number] {
    switch (this.rotation_type) {
      case RotationType.RT_WHD:
        return [this.width, this.height, this.depth];
      case RotationType.RT_HWD:
        return [this.height, this.width, this.depth];
      case RotationType.RT_HDW:
        return [this.height, this.depth, this.width];
      case RotationType.RT_DHW:
        return [this.depth, this.height, this.width];
      case RotationType.RT_DWH:
        return [this.depth, this.width, this.height];
      case RotationType.RT_WDH:
        return [this.width, this.depth, this.height];
      default:
        return [this.width, this.height, this.depth];
    }
  }

  getAvailableRotations(): RotationType[] {
    return this.updown ? ALL_ROTATIONS : NO_UPDOWN_ROTATIONS;
  }
}
