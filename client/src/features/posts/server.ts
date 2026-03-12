import { getSupabaseAdmin } from "@/lib/supabase/server";
import type {
  BoardCode,
  CommentItem,
  CreatePostInput,
  PostDetail,
  PostListItem,
  UpdatePostInput,
} from "@/features/posts/types";

type BoardRow = { id: string; code: string };
type PostRow = {
  id: string;
  board_id: string;
  author_user_id: string;
  title: string;
  scripture_text: string | null;
  content: string | null;
  is_anonymous: boolean;
  is_pinned: boolean;
  comment_count: number;
  amen_count: number;
  created_at: string;
  author: { name: string } | null;
};
type PostDetailRow = PostRow & { board: { code: BoardCode } | null };
type EditablePostRow = {
  id: string;
  author_user_id: string;
  board: { code: BoardCode } | null;
};
type CommentRow = {
  id: string;
  post_id: string;
  content: string;
  is_anonymous: boolean;
  created_at: string;
  author: { name: string } | null;
};
type InsertedPostRow = { id: string };
type AmenStateRow = { post_id: string };
type AmenCountRow = { amen_count: number };

export async function getBoardByCode(boardCode: BoardCode) {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("boards")
    .select("id,code")
    .eq("code", boardCode)
    .eq("is_active", true)
    .maybeSingle<BoardRow>();

  if (error) {
    throw new Error(`Failed to load board: ${error.message}`);
  }

  return data;
}

export async function listPostsByBoardCode(boardCode: BoardCode): Promise<PostListItem[]> {
  const result = await listPostsByBoardCodePaginated(boardCode, 1, 30, null);
  return result.items;
}

export async function listPostsByBoardCodePaginated(
  boardCode: BoardCode,
  page: number,
  pageSize: number,
  viewerUserId: string | null
): Promise<{ items: PostListItem[]; hasMore: boolean }> {
  const board = await getBoardByCode(boardCode);
  if (!board) return { items: [], hasMore: false };

  const supabaseAdmin = getSupabaseAdmin();
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const safePageSize =
    Number.isFinite(pageSize) && pageSize > 0 ? Math.min(Math.floor(pageSize), 30) : 10;
  const from = (safePage - 1) * safePageSize;
  const to = from + safePageSize;

  const listSelectColumns =
    boardCode === "sermon"
      ? "id,board_id,author_user_id,title,scripture_text,is_anonymous,is_pinned,comment_count,amen_count,created_at,author:users!posts_author_user_id_fkey(name)"
      : "id,board_id,author_user_id,title,scripture_text,content,is_anonymous,is_pinned,comment_count,amen_count,created_at,author:users!posts_author_user_id_fkey(name)";

  const { data, error } = await supabaseAdmin
    .from("posts")
    .select(listSelectColumns)
    .eq("board_id", board.id)
    .is("deleted_at", null)
    .order("is_pinned", { ascending: false })
    .order("pinned_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .range(from, to)
    .returns<PostRow[]>();

  if (error) {
    throw new Error(`Failed to load posts: ${error.message}`);
  }

  const items = data ?? [];
  const postIds = items.map((post) => post.id);
  const amenedPostIdSet = new Set<string>();

  if (viewerUserId && postIds.length > 0) {
    const { data: amenRows, error: amenError } = await supabaseAdmin
      .from("post_amens")
      .select("post_id")
      .eq("user_id", viewerUserId)
      .in("post_id", postIds)
      .returns<AmenStateRow[]>();

    if (amenError) {
      throw new Error(`Failed to load amen states: ${amenError.message}`);
    }
    for (const row of amenRows ?? []) amenedPostIdSet.add(row.post_id);
  }

  const mapped = items.map((post) => ({
    id: post.id,
    title: post.title,
    scriptureText: post.scripture_text,
    content: post.content ?? "",
    isAnonymous: post.is_anonymous,
    isPinned: post.is_pinned,
    commentCount: post.comment_count,
    amenCount: post.amen_count,
    hasAmened: amenedPostIdSet.has(post.id),
    createdAt: post.created_at,
    authorName: post.author?.name ?? "알 수 없음",
  }));

  return {
    items: mapped.slice(0, safePageSize),
    hasMore: mapped.length > safePageSize,
  };
}

export async function listPostsByAuthorAndBoardCode(
  authorUserId: string,
  boardCode: BoardCode
): Promise<PostListItem[]> {
  const board = await getBoardByCode(boardCode);
  if (!board) return [];

  const supabaseAdmin = getSupabaseAdmin();
  const listSelectColumns =
    boardCode === "sermon"
      ? "id,board_id,author_user_id,title,scripture_text,is_anonymous,is_pinned,comment_count,amen_count,created_at,author:users!posts_author_user_id_fkey(name)"
      : "id,board_id,author_user_id,title,scripture_text,content,is_anonymous,is_pinned,comment_count,amen_count,created_at,author:users!posts_author_user_id_fkey(name)";

  const { data, error } = await supabaseAdmin
    .from("posts")
    .select(listSelectColumns)
    .eq("author_user_id", authorUserId)
    .eq("board_id", board.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(100)
    .returns<PostRow[]>();

  if (error) {
    throw new Error(`Failed to load my posts: ${error.message}`);
  }

  return (data ?? []).map((post) => ({
    id: post.id,
    title: post.title,
    scriptureText: post.scripture_text,
    content: post.content ?? "",
    isAnonymous: post.is_anonymous,
    isPinned: post.is_pinned,
    commentCount: post.comment_count,
    amenCount: post.amen_count,
    hasAmened: false,
    createdAt: post.created_at,
    authorName: post.author?.name ?? "알 수 없음",
  }));
}

export async function getPostById(postId: string, viewerUserId?: string | null): Promise<PostDetail | null> {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("posts")
    .select(
      "id,board_id,author_user_id,title,scripture_text,content,is_anonymous,is_pinned,comment_count,amen_count,created_at,author:users!posts_author_user_id_fkey(name),board:boards!posts_board_id_fkey(code)"
    )
    .eq("id", postId)
    .is("deleted_at", null)
    .maybeSingle<PostDetailRow>();

  if (error) {
    throw new Error(`Failed to load post: ${error.message}`);
  }
  if (!data || !data.board) return null;

  let hasAmened = false;
  if (viewerUserId) {
    const { data: amenData, error: amenError } = await supabaseAdmin
      .from("post_amens")
      .select("post_id")
      .eq("post_id", postId)
      .eq("user_id", viewerUserId)
      .maybeSingle<AmenStateRow>();
    if (amenError) {
      throw new Error(`Failed to load amen state: ${amenError.message}`);
    }
    hasAmened = Boolean(amenData);
  }

  return {
    id: data.id,
    boardCode: data.board.code,
    authorUserId: data.author_user_id,
    title: data.title,
    scriptureText: data.scripture_text,
    content: data.content ?? "",
    isAnonymous: data.is_anonymous,
    isPinned: data.is_pinned,
    commentCount: data.comment_count,
    amenCount: data.amen_count,
    hasAmened,
    createdAt: data.created_at,
    authorName: data.author?.name ?? "알 수 없음",
  };
}

export async function listCommentsByPostId(postId: string): Promise<CommentItem[]> {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("comments")
    .select("id,post_id,content,is_anonymous,created_at,author:users!comments_author_user_id_fkey(name)")
    .eq("post_id", postId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .returns<CommentRow[]>();

  if (error) {
    throw new Error(`Failed to load comments: ${error.message}`);
  }

  return (data ?? []).map((comment) => ({
    id: comment.id,
    postId: comment.post_id,
    content: comment.content,
    isAnonymous: comment.is_anonymous,
    createdAt: comment.created_at,
    authorName: comment.author?.name ?? "알 수 없음",
  }));
}

function createTitleFromContent(content: string) {
  const compact = content.replace(/\s+/g, " ").trim();
  if (!compact) return "기도제목";
  return compact.length > 30 ? `${compact.slice(0, 30)}...` : compact;
}

export async function createPost(input: CreatePostInput): Promise<string> {
  const board = await getBoardByCode(input.boardCode);
  if (!board) {
    throw new Error("Board not found");
  }

  const content = input.content.trim();
  if (!content) {
    throw new Error("Content is required");
  }

  const scriptureText = (input.scriptureText ?? "").trim();
  const titleInput = (input.title ?? "").trim();
  const title =
    input.boardCode === "sermon"
      ? titleInput
      : titleInput || createTitleFromContent(content);

  if (input.boardCode === "sermon") {
    if (!title) throw new Error("Title is required");
    if (!scriptureText) throw new Error("Scripture text is required");
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("posts")
    .insert({
      board_id: board.id,
      title,
      scripture_text: scriptureText || null,
      content,
      author_user_id: input.authorUserId,
      is_anonymous: input.isAnonymous,
      amen_count: 0,
    })
    .select("id")
    .single<InsertedPostRow>();

  if (error || !data) {
    throw new Error(`Failed to create post: ${error?.message ?? "unknown error"}`);
  }

  return data.id;
}

async function getEditablePostById(postId: string) {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("posts")
    .select("id,author_user_id,board:boards!posts_board_id_fkey(code)")
    .eq("id", postId)
    .is("deleted_at", null)
    .maybeSingle<EditablePostRow>();

  if (error) {
    throw new Error(`Failed to load post: ${error.message}`);
  }
  return data;
}

export async function updatePostById(input: UpdatePostInput) {
  const post = await getEditablePostById(input.postId);
  if (!post || !post.board) {
    throw new Error("POST_NOT_FOUND");
  }
  if (post.author_user_id !== input.authorUserId) {
    throw new Error("FORBIDDEN");
  }

  const content = input.content.trim();
  if (!content) {
    throw new Error("Content is required");
  }

  const updatePayload: {
    title?: string;
    scripture_text?: string | null;
    content: string;
    is_anonymous?: boolean;
  } = {
    content,
  };

  if (post.board.code === "sermon") {
    const title = (input.title ?? "").trim();
    const scriptureText = (input.scriptureText ?? "").trim();
    if (!title) throw new Error("Title is required");
    if (!scriptureText) throw new Error("Scripture text is required");
    updatePayload.title = title;
    updatePayload.scripture_text = scriptureText;
    updatePayload.is_anonymous = false;
  } else {
    updatePayload.title = createTitleFromContent(content);
    updatePayload.scripture_text = null;
    if (typeof input.isAnonymous === "boolean") {
      updatePayload.is_anonymous = input.isAnonymous;
    }
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { error } = await supabaseAdmin
    .from("posts")
    .update(updatePayload)
    .eq("id", input.postId)
    .eq("author_user_id", input.authorUserId)
    .is("deleted_at", null);

  if (error) {
    throw new Error(`Failed to update post: ${error.message}`);
  }
}

export async function softDeletePostById(postId: string, authorUserId: string) {
  const post = await getEditablePostById(postId);
  if (!post) {
    throw new Error("POST_NOT_FOUND");
  }
  if (post.author_user_id !== authorUserId) {
    throw new Error("FORBIDDEN");
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { error } = await supabaseAdmin
    .from("posts")
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: authorUserId,
    })
    .eq("id", postId)
    .eq("author_user_id", authorUserId)
    .is("deleted_at", null);

  if (error) {
    throw new Error(`Failed to delete post: ${error.message}`);
  }
}

export async function togglePostAmen(postId: string, userId: string) {
  const supabaseAdmin = getSupabaseAdmin();

  const { data: existingAmen, error: existingAmenError } = await supabaseAdmin
    .from("post_amens")
    .select("post_id")
    .eq("post_id", postId)
    .eq("user_id", userId)
    .maybeSingle<AmenStateRow>();

  if (existingAmenError) {
    throw new Error(`Failed to check amen state: ${existingAmenError.message}`);
  }

  let hasAmened = false;
  if (existingAmen) {
    const { error } = await supabaseAdmin
      .from("post_amens")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", userId);
    if (error) throw new Error(`Failed to remove amen: ${error.message}`);
    hasAmened = false;
  } else {
    const { error } = await supabaseAdmin
      .from("post_amens")
      .insert({ post_id: postId, user_id: userId });
    if (error) throw new Error(`Failed to add amen: ${error.message}`);
    hasAmened = true;
  }

  const { data: postRow, error: postError } = await supabaseAdmin
    .from("posts")
    .select("amen_count")
    .eq("id", postId)
    .maybeSingle<AmenCountRow>();
  if (postError) {
    throw new Error(`Failed to load amen count: ${postError.message}`);
  }
  if (!postRow) {
    throw new Error("Post not found");
  }

  return { amenCount: postRow.amen_count, hasAmened };
}
