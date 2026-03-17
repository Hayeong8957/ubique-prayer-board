import { getSupabaseAdmin } from "@/lib/supabase/server";
import type {
  BoardCode,
  CommentItem,
  CommentPagination,
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
  author_user_id: string;
  content: string;
  is_anonymous: boolean;
  created_at: string;
  author: { name: string } | null;
};
type InsertedCommentRow = {
  id: string;
  post_id: string;
  author_user_id: string;
  content: string;
  is_anonymous: boolean;
  created_at: string;
  author: { name: string } | null;
};
type EditableCommentRow = {
  id: string;
  post_id: string;
  author_user_id: string;
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
  const postPromise = supabaseAdmin
    .from("posts")
    .select(
      "id,board_id,author_user_id,title,scripture_text,content,is_anonymous,is_pinned,comment_count,amen_count,created_at,author:users!posts_author_user_id_fkey(name),board:boards!posts_board_id_fkey(code)"
    )
    .eq("id", postId)
    .is("deleted_at", null)
    .maybeSingle<PostDetailRow>();

  const amenPromise = viewerUserId
    ? supabaseAdmin
        .from("post_amens")
        .select("post_id")
        .eq("post_id", postId)
        .eq("user_id", viewerUserId)
        .maybeSingle<AmenStateRow>()
    : null;

  const [postResult, amenResult] = await Promise.all([
    postPromise,
    amenPromise ?? Promise.resolve({ data: null, error: null }),
  ]);

  const { data, error } = postResult;

  if (error) {
    throw new Error(`Failed to load post: ${error.message}`);
  }
  if (!data || !data.board) return null;

  const amenError = amenResult?.error ?? null;
  if (amenError) {
    throw new Error(`Failed to load amen state: ${amenError.message}`);
  }
  const hasAmened = Boolean(amenResult?.data);

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

function mapComment(comment: CommentRow | InsertedCommentRow): CommentItem {
  return {
    id: comment.id,
    postId: comment.post_id,
    authorUserId: comment.author_user_id,
    content: comment.content,
    isAnonymous: comment.is_anonymous,
    createdAt: comment.created_at,
    authorName: comment.author?.name ?? "알 수 없음",
  };
}

export async function listCommentsByPostIdPaginated(
  postId: string,
  page: number,
  pageSize: number
): Promise<{ items: CommentItem[]; pagination: CommentPagination }> {
  const supabaseAdmin = getSupabaseAdmin();
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const safePageSize =
    Number.isFinite(pageSize) && pageSize > 0 ? Math.min(Math.floor(pageSize), 20) : 5;
  const from = (safePage - 1) * safePageSize;
  const to = from + safePageSize;

  const { data, error } = await supabaseAdmin
    .from("comments")
    .select(
      "id,post_id,author_user_id,content,is_anonymous,created_at,author:users!comments_author_user_id_fkey(name)"
    )
    .eq("post_id", postId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(from, to)
    .returns<CommentRow[]>();

  if (error) {
    throw new Error(`Failed to load comments: ${error.message}`);
  }

  const rows = data ?? [];
  const pageRows = rows.slice(0, safePageSize).reverse();

  return {
    items: pageRows.map(mapComment),
    pagination: {
      page: safePage,
      pageSize: safePageSize,
      hasMore: rows.length > safePageSize,
      nextPage: rows.length > safePageSize ? safePage + 1 : null,
    },
  };
}

async function ensureVisiblePost(postId: string) {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("posts")
    .select("id")
    .eq("id", postId)
    .is("deleted_at", null)
    .maybeSingle<{ id: string }>();

  if (error) {
    throw new Error(`Failed to load post for comment: ${error.message}`);
  }

  return data;
}

export async function createComment(input: {
  postId: string;
  authorUserId: string;
  content: string;
  isAnonymous?: boolean;
}): Promise<CommentItem> {
  const post = await ensureVisiblePost(input.postId);
  if (!post) {
    throw new Error("POST_NOT_FOUND");
  }

  const content = input.content.trim();
  if (!content) {
    throw new Error("Content is required");
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("comments")
    .insert({
      post_id: input.postId,
      author_user_id: input.authorUserId,
      content,
      is_anonymous: input.isAnonymous ?? false,
    })
    .select(
      "id,post_id,author_user_id,content,is_anonymous,created_at,author:users!comments_author_user_id_fkey(name)"
    )
    .single<InsertedCommentRow>();

  if (error || !data) {
    throw new Error(`Failed to create comment: ${error?.message ?? "unknown error"}`);
  }

  return mapComment(data);
}

async function getEditableCommentById(commentId: string) {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("comments")
    .select("id,post_id,author_user_id")
    .eq("id", commentId)
    .is("deleted_at", null)
    .maybeSingle<EditableCommentRow>();

  if (error) {
    throw new Error(`Failed to load comment: ${error.message}`);
  }

  return data;
}

export async function updateCommentById(input: {
  commentId: string;
  postId: string;
  authorUserId: string;
  content: string;
}): Promise<CommentItem> {
  const comment = await getEditableCommentById(input.commentId);
  if (!comment || comment.post_id !== input.postId) {
    throw new Error("COMMENT_NOT_FOUND");
  }
  if (comment.author_user_id !== input.authorUserId) {
    throw new Error("FORBIDDEN");
  }

  const content = input.content.trim();
  if (!content) {
    throw new Error("Content is required");
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("comments")
    .update({ content })
    .eq("id", input.commentId)
    .eq("author_user_id", input.authorUserId)
    .eq("post_id", input.postId)
    .is("deleted_at", null)
    .select(
      "id,post_id,author_user_id,content,is_anonymous,created_at,author:users!comments_author_user_id_fkey(name)"
    )
    .single<InsertedCommentRow>();

  if (error || !data) {
    throw new Error(`Failed to update comment: ${error?.message ?? "unknown error"}`);
  }

  return mapComment(data);
}

export async function softDeleteCommentById(input: {
  commentId: string;
  postId: string;
  authorUserId: string;
}) {
  const comment = await getEditableCommentById(input.commentId);
  if (!comment || comment.post_id !== input.postId) {
    throw new Error("COMMENT_NOT_FOUND");
  }
  if (comment.author_user_id !== input.authorUserId) {
    throw new Error("FORBIDDEN");
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { error } = await supabaseAdmin
    .from("comments")
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: input.authorUserId,
    })
    .eq("id", input.commentId)
    .eq("author_user_id", input.authorUserId)
    .eq("post_id", input.postId)
    .is("deleted_at", null);

  if (error) {
    throw new Error(`Failed to delete comment: ${error.message}`);
  }
}

export async function listCommentsByPostId(postId: string): Promise<CommentItem[]> {
  const result = await listCommentsByPostIdPaginated(postId, 1, 100);
  return result.items;
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
