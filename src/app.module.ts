import { Module } from '@nestjs/common';
import { PdfLoaderModule } from './pdf-loader/pdf-loader.module';
import { VectorStoreModule } from './vector-store/vector-store.module';
import { AudioModule } from './audio/audio.module';
import { MulterModule } from '@nestjs/platform-express';
import { ManageVectorStoreModule } from './manage-vector-store/manage-vector-store.module';
import { RealtimeModule } from './realtime/realtime.module';
import { ContextModule } from './context/context.module';
import { AppointmentsModule } from './appointments/appointment.module';
import { ConfigModule } from './config/config.module';
import { SupabaseModule } from './supabase/supabase.module';
import { FunctionHandlerModule } from './function-handler/function-handler.module';

@Module({
  imports: [
    ConfigModule,
    SupabaseModule,
    PdfLoaderModule,
    VectorStoreModule,
    AudioModule,
    MulterModule.register({
      dest: './uploads',
    }),
    ManageVectorStoreModule,
    RealtimeModule,
    ContextModule,
    AppointmentsModule,
    FunctionHandlerModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
