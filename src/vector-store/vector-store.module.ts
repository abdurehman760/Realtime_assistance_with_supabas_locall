import { Module } from '@nestjs/common';
import { VectorStoreService } from './vector-store.service';
import { AudioModule } from '../audio/audio.module';

@Module({
  imports: [AudioModule],
  providers: [VectorStoreService],
  exports: [VectorStoreService],
})
export class VectorStoreModule {}
