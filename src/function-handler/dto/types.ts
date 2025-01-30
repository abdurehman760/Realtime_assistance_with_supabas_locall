/**
 * Represents a function stored in Supabase.
 */
export type SupabaseFunction = {
    id: string;
    created_at: Date;
    type: string;
    data: any;
    created_by: string;
    assistant_id: string;
    is_active: boolean;
    name: string;
    purpose: string;
    trigger_reason: string;
    variables: Array<{
      var_id: string;
      var_name: string;
      var_type: string;
      var_reason: string;
    }>;
    save_data: boolean;
    is_shownable: boolean;
  };
  
  /**
   * Represents the structure of OpenAI-compatible tools.
   */
  export type OpenAITool = {
    type: 'function';
    function: {
      name: string;
      description: string;
      parameters: any; // JSON Schema
    };
  };
  
  /**
   * DTO for creating a new function.
   */
  export type CreateFunctionDto = {
    type?: string;
    data?: any;
    created_by?: string;
    assistant_id?: string;
    is_active?: boolean;
    name: string;
    purpose: string;
    trigger_reason?: string;
    variables: Array<{
      var_id: string;
      var_name: string;
      var_type: string;
      var_reason: string;
    }>;
    save_data?: boolean;
    is_shownable?: boolean;
  };