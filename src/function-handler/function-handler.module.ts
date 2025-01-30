import { Module } from '@nestjs/common';
import { FunctionHandlerService } from './function-handler.service';
import { FunctionHandlerController } from './function-handler.controller';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [FunctionHandlerController],
  providers: [FunctionHandlerService],
  exports: [FunctionHandlerService],
})
export class FunctionHandlerModule {}