import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { OpenAI } from 'openai';
import { SupabaseFunction, CreateFunctionDto } from './dto/types';

@Injectable()
export class FunctionHandlerService implements OnModuleInit {
  private readonly logger = new Logger(FunctionHandlerService.name);
  private cachedTools: OpenAI.ChatCompletionTool[] | null = null;
  private subscription: any;

  constructor(private readonly supabase: SupabaseService) {}

  async onModuleInit() {
    await this.setupRealtimeSubscription();
  }

  private async setupRealtimeSubscription() {
    this.subscription = this.supabase.client
      .channel('functions_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'functions',
        },
        async (payload) => {
          // Force refresh cached tools
          await this.refreshTools();
        }
      )
      .subscribe();

    // Initial load
    await this.refreshTools();
    this.logger.log('Real-time function subscription initialized');
  }

  // Add new method to refresh tools
  private async refreshTools() {
    try {
      const { data, error } = await this.supabase.client
        .from('functions')
        .select('*')
        .eq('is_active', true);

      if (error) {
        this.logger.error('Error refreshing functions:', error.message);
        return;
      }

      this.cachedTools = data.map(fn => this.transformFunction(fn));
      console.log('\nFunctions Updated');
      console.log('--------------------------');
      console.log('Total active functions:', this.cachedTools.length);
      this.cachedTools.forEach((tool, index) => {
        console.log(`\nFunction ${index + 1}:`, tool.function.name);
      });
      console.log('--------------------------');
    } catch (error) {
      this.logger.error('Failed to refresh tools:', error);
    }
  }

  /**
   * Fetches all active functions and transforms them into OpenAI-compatible tools.
   */
  async getOpenAITools(): Promise<OpenAI.ChatCompletionTool[]> {
    // Always fetch fresh data
    await this.refreshTools();
    return this.cachedTools || [];
  }

  /**
   * Inserts a new function into the functions table.
   */
  async createFunction(createFunctionDto: CreateFunctionDto): Promise<SupabaseFunction> {
    console.log('\n=== Creating New Function ===');
    console.log('📝 Function Details:');
    console.log(JSON.stringify(createFunctionDto, null, 2));

    const { data, error } = await this.supabase.client
      .from('functions')
      .insert([createFunctionDto])
      .select()
      .single();

    if (error) {
      this.logger.error(`❌ Supabase error: ${error.message}`);
      console.error('Creation failed:', error);
      throw error;
    }

    console.log('\n✅ Function Created Successfully');
    console.log('📦 Created Function:');
    console.log(JSON.stringify(data, null, 2));
    console.log('============================\n');

    this.logger.log(`Function created: ${data.id}`);
    return data;
  }

  /**
   * Transforms a Supabase function into an OpenAI-compatible tool.
   */
  private transformFunction(fn: SupabaseFunction): OpenAI.ChatCompletionTool {
    return {
      type: "function" as const,
      function: {
        name: this.toSnakeCase(fn.name),
        description: fn.purpose,
        parameters: this.buildParameters(fn.variables),
      },
    };
  }

  /**
   * Converts a string to snake_case.
   * Handles spaces, hyphens, and special characters.
   */
  private toSnakeCase(str: string): string {
    return str
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_') // Replace any non-alphanumeric characters with underscore
      .replace(/^_+|_+$/g, '') // Remove leading and trailing underscores
      .replace(/_+/g, '_'); // Replace multiple underscores with single underscore
  }

  /**
   * Builds JSON Schema parameters from Supabase variables.
   */
  private buildParameters(variables: any[]): any {
    const properties = {};
    const required = [];

    variables.forEach((variable) => {
      properties[variable.var_name] = {
        type: this.mapType(variable.var_type),
        description: variable.var_reason,
      };

      // Add format for special types (e.g., email)
      if (variable.var_type === 'email') {
        properties[variable.var_name].format = 'email';
      }

      required.push(variable.var_name);
    });

    return {
      type: 'object',
      properties,
      required,
    };
  }

  /**
   * Maps custom variable types to JSON Schema types.
   */
  private mapType(varType: string): string {
    const typeMap = {
      text: 'string',
      email: 'string',
      number: 'number',
      boolean: 'boolean',
    };
    return typeMap[varType] || 'string';
  }
}