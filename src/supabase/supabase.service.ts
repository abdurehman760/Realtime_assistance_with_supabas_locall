import { Injectable } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private _client: SupabaseClient;

  constructor() {
    this._client = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_PRIVATE_KEY || ''
    );
  }

  get client() {
    return this._client;
  }
}
