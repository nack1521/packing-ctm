import { Controller, Get, Post, Body, Patch, Param, Delete, HttpStatus, HttpException } from '@nestjs/common';
import { PackagesService } from './packages.service';
import { CreatePackageDto } from './dto/create-package.dto';
import { UpdatePackageDto } from './dto/update-package.dto';

@Controller('packages')
export class PackagesController {
  constructor(private readonly packagesService: PackagesService) {}

  @Post()
  async create(@Body() createPackageDto: CreatePackageDto) {
    try {
      return await this.packagesService.create(createPackageDto);
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to create package',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get()
  async findAll() {
    try {
      return await this.packagesService.findAll();
    } catch (error) {
      throw new HttpException(
        'Failed to fetch packages',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    try {
      return await this.packagesService.findOne(id);
    } catch (error) {
      throw new HttpException(
        'Package not found',
        HttpStatus.NOT_FOUND,
      );
    }
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() updatePackageDto: UpdatePackageDto) {
    try {
      return await this.packagesService.update(id, updatePackageDto);
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to update package',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    try {
      return await this.packagesService.remove(id);
    } catch (error) {
      throw new HttpException(
        'Failed to delete package',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
