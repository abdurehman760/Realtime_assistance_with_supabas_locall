import { Controller, Get, Query, Res, Sse, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { PdfLoaderService } from './pdf-loader.service';
import { VectorStoreService } from '../vector-store/vector-store.service';
import { Response } from 'express';
import { Observable } from 'rxjs';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { unlink } from 'fs/promises';

interface CustomMessageEvent {
  data: {
    type: string;
    data: any;
  };
  id?: string;
  type?: string;
  retry?: number;
}

@Controller('pdf-loader')
export class PdfLoaderController {
  constructor(
    private readonly pdfLoaderService: PdfLoaderService,
    private readonly vectorStoreService: VectorStoreService
  ) {}

  @Get('load-pdf')
  async loadPdf() {
    const chunkedDocs = await this.pdfLoaderService.getChunkedDocsFromPDF(process.env.PDF_PATH);
    console.log(chunkedDocs);
    return chunkedDocs;
  }

  @Get('load-and-store-pdf')
  async loadAndStorePdf() {
    await this.pdfLoaderService.loadAndStorePDF();
    return { message: 'PDF loaded and stored in Supabase successfully' };
  }

  @Sse('retrieve-data')
  async retrieveData(@Query('query') query: string): Promise<Observable<CustomMessageEvent>> {
    return new Observable(subscriber => {
      this.vectorStoreService.retrieveFromStore(
        query,
        (chunk, isAudio) => {
          const message: CustomMessageEvent = {
            data: isAudio ? {
              type: 'audio',
              data: chunk.toString('base64')
            } : {
              type: 'text',
              data: chunk
            }
          };
          subscriber.next(message);
        }
      ).finally(() => subscriber.complete());
    });
  }

  @Post('upload-and-train')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: './uploads',
      filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
      },
    }),
  }))
  async uploadAndTrainPdf(@UploadedFile() file: Express.Multer.File) {
    try {
      await this.pdfLoaderService.loadAndStorePDF(file.path);
      // Delete the file after processing
      await unlink(file.path);
      return { message: 'PDF uploaded, processed and stored in Supabase successfully' };
    } catch (error) {
      // Try to delete the file even if processing failed
      try {
        await unlink(file.path);
      } catch (deleteError) {
        console.error('Error deleting file:', deleteError);
      }
      throw error;
    }
  }
}
