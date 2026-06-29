/**
 * Generated-style Supabase types. Edit by hand for now; replace with
 * `supabase gen types typescript` output once the project is linked.
 */
export type Role = "admin" | "pro" | "free";
export type ProductType = "sfh" | "duplex" | "fourplex" | "small_multi" | "infill" | "other";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          avatar_url: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
      };
      user_roles: {
        Row: { id: string; user_id: string; role: Role; created_at: string };
        Insert: { id?: string; user_id: string; role: Role; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["user_roles"]["Insert"]>;
      };
      deals: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          address: string | null;
          inputs: Record<string, unknown>;
          results: Record<string, unknown>;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          address?: string | null;
          inputs: Record<string, unknown>;
          results: Record<string, unknown>;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["deals"]["Insert"]>;
      };
      saved_polygons: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          geojson: Record<string, unknown>;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          geojson: Record<string, unknown>;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["saved_polygons"]["Insert"]>;
      };
      builder_directory: {
        Row: {
          id: string;
          metro: string;
          name: string;
          contact_url: string | null;
          phone: string | null;
          license_no: string | null;
          product_types: ProductType[];
          active_projects: number;
          typical_price_band: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          metro: string;
          name: string;
          contact_url?: string | null;
          phone?: string | null;
          license_no?: string | null;
          product_types?: ProductType[];
          active_projects?: number;
          typical_price_band?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["builder_directory"]["Insert"]>;
      };
    };
    Views: {
      profile_with_role: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          created_at: string;
          role: Role;
        };
      };
    };
    Functions: {
      has_role: { Args: { _user_id: string; _role: Role }; Returns: boolean };
      set_user_role: { Args: { _target: string; _role: Role }; Returns: void };
    };
  };
}
