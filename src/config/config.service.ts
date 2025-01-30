import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { UpdateConfigDto } from './dto/update-config.dto';
import { updateAIConfig } from './ai.config';
import { SystemConfig } from './dto/system-config.interface';

@Injectable()
export class ConfigService implements OnModuleInit, OnModuleDestroy {
  private static instance: ConfigService;
  private cachedConfig: SystemConfig | null = null;
  private readonly logger = new Logger(ConfigService.name);
  private subscription: any;

  static getInstance(): ConfigService {
    return ConfigService.instance;
  }

  constructor(private readonly supabase: SupabaseService) {
    ConfigService.instance = this;
  }

  async onModuleInit() {
    await this.initializeConfig();
    this.setupRealtimeSubscription();
  }

  async onModuleDestroy() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  // Add logging to initialization
  private async initializeConfig() {
    try {
      console.log('\n=== Initializing Configuration ===');
      
      const { data, error } = await this.supabase.client
        .from('system_config')
        .select('value')
        .single();

      if (error) throw error;
      
      console.log('Loading initial config:', JSON.stringify(data.value, null, 2));
      
      this.cachedConfig = data.value;
      updateAIConfig(data.value);
      
      this.logger.log('✅ Configuration loaded successfully');
      console.log('================================\n');
    } catch (error) {
      this.logger.error(`❌ Error initializing config: ${error.message}`);
      console.error('Initialization failed:', error);
      throw error;
    }
  }

  private setupRealtimeSubscription() {
    // Set up real-time subscription to track config changes
    this.subscription = this.supabase.client
      .channel('system_config_changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'system_config'
        },
        (payload) => {
          console.log('\n=== Configuration Update Detected ===');
          console.log('Previous config:', JSON.stringify(this.cachedConfig, null, 2));
          console.log('New config:', JSON.stringify(payload.new.value, null, 2));
          
          // Update local cache and AI configuration
          this.cachedConfig = payload.new.value;
          updateAIConfig(payload.new.value);
          
          this.logger.log('✅ Configuration updated successfully via real-time subscription');
          console.log('=====================================\n');
        }
      )
      .subscribe();

    this.logger.log('🔌 Real-time configuration subscription initialized');
  }

  getStaticConfig() {
    return this.cachedConfig;
  }

  async getConfig() {
    try {
      const { data, error } = await this.supabase.client
        .from('system_config')
        .select('value, updated_at')
        .single();

      if (error) throw error;
      return {
        ...data.value,
        lastUpdated: data.updated_at
      };
    } catch (error) {
      this.logger.error(`Error fetching config: ${error.message}`);
      throw error;
    }
  }

  async updateConfig(updateDto: UpdateConfigDto) {
    try {
      console.log('\n=== Manual Configuration Update ===');
      console.log('Current config:', JSON.stringify(this.cachedConfig, null, 2));
      console.log('Update request:', JSON.stringify(updateDto, null, 2));

      // Update configuration in Supabase
      const { data, error } = await this.supabase.client
        .from('system_config')
        .update({ value: updateDto })
        .eq('id', 1)
        .select()
        .single();

      if (error) throw error;

      // Update local cache and AI configuration
      this.cachedConfig = updateDto;
      updateAIConfig(updateDto);

      this.logger.log('✅ Configuration manually updated successfully');
      console.log('Updated at:', data.updated_at);
      console.log('=================================\n');

      return { 
        success: true, 
        message: 'Configuration updated successfully',
        lastUpdated: data.updated_at
      };
    } catch (error) {
      this.logger.error(`❌ Error updating config: ${error.message}`);
      console.error('Update failed:', error);
      throw error;
    }
  }
}
