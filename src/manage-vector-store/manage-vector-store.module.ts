import { Module } from '@nestjs/common';
import { ManageVectorStoreService } from './manage-vector-store.service';
import { ManageVectorStoreController } from './manage-vector-store.controller';
import { AudioModule } from '../audio/audio.module';

@Module({
  imports: [AudioModule],
  controllers: [ManageVectorStoreController],
  providers: [ManageVectorStoreService],
  exports: [ManageVectorStoreService],
})
export class ManageVectorStoreModule {}
