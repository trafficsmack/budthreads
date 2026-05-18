const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface Product {
  id: string;
  title: string;
  description: string;
  price: string;
  image_url: string;
  image_urls: string[];
  shopify_id: string;
  variants?: ProductVariant[];
}

export interface ProductVariant {
  id: string;
  title: string;
  price: string;
  inventory_quantity: number;
}

export interface Post {
  id: string;
  product_id: string;
  platform: "instagram" | "facebook" | "tiktok";
  caption: string;
  hashtags: string[];
  status: "draft" | "scheduled" | "published" | "failed";
  scheduled_at?: string;
  published_at?: string;
  created_at: string;
  updated_at: string;
  media_urls?: string[];
}

export interface CreatePostPayload {
  product_id: string;
  platform: "instagram" | "facebook" | "tiktok";
  caption: string;
  hashtags: string[];
  status?: "draft" | "scheduled";
  scheduled_at?: string;
  media_urls?: string[];
}

export interface AgentStreamEvent {
  type: "progress" | "result" | "error" | "done";
  message?: string;
  data?: Record<string, unknown>;
}

export const api = {
  // Products
  getProducts: (): Promise<Product[]> =>
    fetch(`${API_URL}/api/products`).then((r) => r.json()),

  syncShopify: (): Promise<{ synced: number; message: string }> =>
    fetch(`${API_URL}/api/products/sync`, { method: "POST" }).then((r) =>
      r.json()
    ),

  // Posts
  getPosts: (filters?: {
    platform?: string;
    status?: string;
  }): Promise<Post[]> => {
    const params = new URLSearchParams();
    if (filters?.platform) params.set("platform", filters.platform);
    if (filters?.status) params.set("status", filters.status);
    const query = params.toString() ? `?${params.toString()}` : "";
    return fetch(`${API_URL}/api/posts${query}`).then((r) => r.json());
  },

  createPost: (post: CreatePostPayload): Promise<Post> =>
    fetch(`${API_URL}/api/posts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(post),
    }).then((r) => r.json()),

  updatePost: (id: string, post: Partial<CreatePostPayload>): Promise<Post> =>
    fetch(`${API_URL}/api/posts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(post),
    }).then((r) => r.json()),

  deletePost: (id: string): Promise<{ success: boolean }> =>
    fetch(`${API_URL}/api/posts/${id}`, { method: "DELETE" }).then((r) =>
      r.json()
    ),

  publishPost: (id: string): Promise<Post> =>
    fetch(`${API_URL}/api/posts/${id}/publish`, { method: "POST" }).then((r) =>
      r.json()
    ),

  // Dashboard stats
  getStats: (): Promise<{
    total_posts: number;
    published_this_week: number;
    draft_posts: number;
    total_products: number;
  }> => fetch(`${API_URL}/api/stats`).then((r) => r.json()),
};

// SSE streaming for agent calls
export async function* streamAgentResponse(
  url: string,
  body?: object
): AsyncGenerator<AgentStreamEvent> {
  const response = await fetch(`${API_URL}${url}`, {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try {
          yield JSON.parse(line.slice(6));
        } catch {
          // skip malformed lines
        }
      }
    }
  }
}
