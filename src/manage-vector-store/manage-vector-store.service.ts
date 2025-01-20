import { Injectable } from '@nestjs/common';
import { createClient } from "@supabase/supabase-js";
import * as dotenv from 'dotenv';

dotenv.config();

@Injectable()
export class ManageVectorStoreService {
  private supabaseClient: any;

  constructor() {
    this.supabaseClient = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PRIVATE_KEY!
    );
  }

  async getAllDocuments() {
    const { data, error } = await this.supabaseClient
      .from('documents')
      .select('id, content')
      .order('id', { ascending: true });

    if (error) throw error;
    return data;
  }

  async deleteDocument(id: number) {
    const { error } = await this.supabaseClient
      .from('documents')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return { message: `Document ${id} deleted successfully` };
  }

  async deleteAllDocuments() {
    const { error } = await this.supabaseClient
      .from('documents')
      .delete()
      .neq('id', 0); // Delete all documents

    if (error) throw error;
    return { message: 'All documents deleted successfully' };
  }

  async getDocumentCount() {
    const { data, error } = await this.supabaseClient
      .from('documents')
      .select('count')
      .single();

    if (error) throw error;
    return data;
  }
}
