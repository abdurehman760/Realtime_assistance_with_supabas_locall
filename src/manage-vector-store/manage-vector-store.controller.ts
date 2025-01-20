import { Controller, Delete, Get, Param, Res } from '@nestjs/common';
import { ManageVectorStoreService } from './manage-vector-store.service';
import { Response } from 'express';
import { join } from 'path';

@Controller('manage-vector-store')
export class ManageVectorStoreController {
  constructor(private readonly manageVectorStoreService: ManageVectorStoreService) {}

  @Get()
  getManagePage(@Res() res: Response) {
    return res.sendFile(join(process.cwd(), 'public', 'manage-vector-store.html'));
  }

  @Get('documents')
  async getAllDocuments() {
    return this.manageVectorStoreService.getAllDocuments();
  }

  @Delete('documents/:id')
  async deleteDocument(@Param('id') id: number) {
    return this.manageVectorStoreService.deleteDocument(id);
  }

  @Delete('documents')
  async deleteAllDocuments() {
    return this.manageVectorStoreService.deleteAllDocuments();
  }

  @Get('count')
  async getDocumentCount() {
    return this.manageVectorStoreService.getDocumentCount();
  }
}
