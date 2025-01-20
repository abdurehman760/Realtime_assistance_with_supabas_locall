import { Module } from '@nestjs/common';
import { PdfLoaderController } from './pdf-loader.controller';
import { PdfLoaderService } from './pdf-loader.service';
import { VectorStoreModule } from '../vector-store/vector-store.module';

@Module({
  imports: [VectorStoreModule],
  controllers: [PdfLoaderController],
  providers: [PdfLoaderService],
})
export class PdfLoaderModule {}
