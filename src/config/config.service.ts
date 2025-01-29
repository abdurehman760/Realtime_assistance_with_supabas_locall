import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { UpdateConfigDto } from './dto/update-config.dto';
import { updateAIConfig } from './ai.config';
import { SystemConfig } from './dto/system-config.interface';

@Injectable()
export class ConfigService implements OnModuleInit {
  private static instance: ConfigService;
  private cachedConfig: SystemConfig | null = null;
  private readonly logger = new Logger(ConfigService.name);

  static getInstance(): ConfigService {
    return ConfigService.instance;
  }

  constructor(private readonly supabase: SupabaseService) {
    ConfigService.instance = this;
  }

  async onModuleInit() {
    await this.initializeConfig();
  }

  private async initializeConfig() {
    try {
      const { data, error } = await this.supabase.client
        .from('system_config')
        .select('value')
        .single();

      if (error) throw error;
      
      this.cachedConfig = data.value;
      updateAIConfig(data.value);
      
      this.logger.log('Configuration loaded successfully');
    } catch (error) {
      this.logger.error(`Error initializing config: ${error.message}`);
      throw error;
    }
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
      const { error } = await this.supabase.client
        .from('system_config')
        .update({ value: updateDto })
        .eq('id', 1);

      if (error) throw error;

      return { success: true, message: 'Configuration updated successfully' };
    } catch (error) {
      this.logger.error(`Error updating config: ${error.message}`);
      throw error;
    }
  }

  async validateConfig(config: UpdateConfigDto) {
    // Add any additional validation logic here
    if (config.phoneFormat.maxDigits < config.phoneFormat.minDigits) {
      throw new Error('Maximum digits cannot be less than minimum digits');
    }
    return true;
  }
}
